"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Address, formatUnits, parseUnits } from "viem";
import { getAddress, isAddress } from "viem";
import { useAccount } from "wagmi";
import { useWriteContract } from "wagmi";
import deployed from "~~/contracts/deployedContracts";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth/useScaffoldReadContract";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth/useScaffoldWriteContract";

const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID) || 31337;
const swapAddr = (deployed as Record<number, any>)[CHAIN_ID].SimpleSwap.address as Address;
const contractName = "SimpleSwap";

/* ------------------------- TOKENS ------------------------- */
type TokenProps = { name: "BOOKE" | "MIAMI" };

const TokenClaim = ({ name }: TokenProps) => {
  const { address } = useAccount();
  const [amount, setAmount] = useState("");
  const tokenAddr = (deployed as Record<number, any>)[CHAIN_ID][name].address as Address;
  const { writeContractAsync, isPending } = useScaffoldWriteContract(name);
  const { data: balance } = useScaffoldReadContract({
    contractName: name,
    functionName: "balanceOf",
    args: [address as Address],
    watch: true,
  });

  const claim = async () => {
    if (!amount) return;

    const raw = BigInt(amount);

    await writeContractAsync(
      {
        functionName: "mint",
        args: [raw],
      },
      {
        onBlockConfirmation: tx => {
          toast.dismiss();
          toast.success(
            <>
              <p>Minted ✅</p>
              <p className="break-all text-xs">{tx.transactionHash}</p>
            </>,
          );
        },
      },
    );
  };

  return (
    <div className="card w-full max-w-md bg-base-200 shadow-lg p-6 space-y-3">
      <h2 className="text-xl font-bold">
        {name}
        <span className="block text-xs break-all text-neutral-400">{tokenAddr}</span>
      </h2>
      <input
        className="input input-bordered w-full"
        type="number"
        min="0"
        step="any"
        placeholder="amount (tokens)"
        value={amount}
        onChange={e => setAmount(e.target.value)}
      />
      <button className="btn btn-primary w-full" disabled={!address || !amount || isPending} onClick={claim}>
        {isPending ? "Sending…" : "Claim"}
      </button>
      <div className="text-center">balance: {balance ? formatUnits(balance, 18) : "0"} tokens</div>
    </div>
  );
};

type ApproveTokensProps = {
  tokenAContract: Address;
  tokenBContract: Address;
  amountA: string;
  amountB: string;
};

const useApproveTokens = (swapAddr: Address) => {
  const { writeContractAsync } = useWriteContract();

  return async ({ tokenAContract, tokenBContract, amountA, amountB }: ApproveTokensProps) => {
    await writeContractAsync({
      address: tokenAContract,
      abi: [
        {
          type: "function",
          name: "approve",
          inputs: [
            { name: "spender", type: "address" },
            { name: "value", type: "uint256" },
          ],
          outputs: [{ type: "bool" }],
        },
      ],
      functionName: "approve",
      args: [swapAddr, parseUnits(amountA, 18)],
    });

    await writeContractAsync({
      address: tokenBContract,
      abi: [
        {
          type: "function",
          name: "approve",
          inputs: [
            { name: "spender", type: "address" },
            { name: "value", type: "uint256" },
          ],
          outputs: [{ type: "bool" }],
        },
      ],
      functionName: "approve",
      args: [swapAddr, parseUnits(amountB, 18)],
    });
  };
};

/* --------------------- SIMPLE SWAP --------------------- */
const useToastWrite = (c: "BOOKE" | "MIAMI" | "SimpleSwap") => useScaffoldWriteContract(c).writeContractAsync;

/**
 * getPrice
 */
const SwapGetPrice = () => {
  const [tokenA, setA] = useState("");
  const [tokenB, setB] = useState("");
  const shouldRead = Boolean(tokenA && tokenB);
  const { data, isError, error } = useScaffoldReadContract(
    shouldRead
      ? {
          contractName,
          functionName: "getPrice",
          args: [tokenA as Address, tokenB as Address],
        }
      : {
          contractName,
          functionName: "getPrice",
          args: [undefined, undefined],
        },
  );

  let body = null;
  if (isError && error?.message?.includes("NO_LIQUIDITY")) {
    body = <p className="italic text-sm text-red-500">No liquidity for this pair</p>;
  } else if (data !== undefined) {
    body = <p>price: {formatUnits(data, 18)}</p>;
  }

  return (
    <div className="card bg-base-200 p-4 space-y-2">
      <h3 className="font-bold">getPrice</h3>
      <input
        className="input input-bordered w-full"
        placeholder="tokenA address"
        value={tokenA}
        onChange={e => setA(e.target.value)}
      />
      <input
        className="input input-bordered w-full"
        placeholder="tokenB address"
        value={tokenB}
        onChange={e => setB(e.target.value)}
      />
      {body}
    </div>
  );
};

/**
 * totalLiquidity
 */
const SwapGetLiquidity = () => {
  const [tokenA, setA] = useState("");
  const [tokenB, setB] = useState("");
  const shouldRead = Boolean(tokenA && tokenB);
  const { data, isError } = useScaffoldReadContract(
    shouldRead
      ? {
          contractName,
          functionName: "totalLiquidity",
          args: [tokenA as Address, tokenB as Address],
        }
      : {
          contractName,
          functionName: "totalLiquidity",
          args: [undefined, undefined],
        },
  );

  let body = null;
  if (isError) {
    body = <p className="italic text-sm text-red-500">No liquidity for this pair</p>;
  } else if (data !== undefined) {
    body = <p>liquidity: {formatUnits(data, 18)} LP</p>;
  }

  return (
    <div className="card bg-base-200 p-4 space-y-2">
      <h3 className="font-bold">getLiquidity</h3>
      <input
        className="input input-bordered w-full"
        placeholder="tokenA address"
        value={tokenA}
        onChange={e => setA(e.target.value)}
      />
      <input
        className="input input-bordered w-full"
        placeholder="tokenB address"
        value={tokenB}
        onChange={e => setB(e.target.value)}
      />
      {body}
    </div>
  );
};

/**
 * addLiquidity
 */
const SwapAddLiquidity = () => {
  const { address } = useAccount();
  const [f, sF] = useState({
    tokenA: "",
    tokenB: "",
    amountADesired: "",
    amountBDesired: "",
    amountAMin: "",
    amountBMin: "",
    deadline: "",
  });

  const approveTokens = useApproveTokens(swapAddr);
  const write = useScaffoldWriteContract(contractName).writeContractAsync;

  const add = async () => {
    if (!isAddress(f.tokenA) || !isAddress(f.tokenB)) {
      toast.error("Invalid token address");
      return;
    }

    const tokenAAddress = getAddress(f.tokenA);
    const tokenBAddress = getAddress(f.tokenB);

    await approveTokens({
      tokenAContract: tokenAAddress,
      tokenBContract: tokenBAddress,
      amountA: f.amountADesired,
      amountB: f.amountBDesired,
    });

    await write({
      functionName: "addLiquidity",
      args: [
        tokenAAddress,
        tokenBAddress,
        parseUnits(f.amountADesired, 18),
        parseUnits(f.amountBDesired, 18),
        parseUnits(f.amountAMin, 18),
        parseUnits(f.amountBMin, 18),
        address as Address,
        BigInt(f.deadline),
      ],
    });

    toast.success(<>Liquidity added ✅</>);
  };

  return (
    <div className="card bg-base-200 p-4 space-y-2">
      <h3 className="font-bold">addLiquidity</h3>
      {(["tokenA", "tokenB", "amountADesired", "amountBDesired", "amountAMin", "amountBMin", "deadline"] as const).map(
        k => (
          <input
            key={k}
            className="input input-bordered w-full"
            placeholder={k}
            value={(f as any)[k]}
            onChange={e => sF({ ...f, [k]: e.target.value })}
          />
        ),
      )}
      <button className="btn btn-primary w-full" onClick={add}>
        add
      </button>
    </div>
  );
};

/**
 * removeLiquidity
 */
const SwapRemoveLiquidity = () => {
  const { address } = useAccount();
  const [f, sF] = useState({
    tokenA: "",
    tokenB: "",
    liquidity: "",
    amountAMin: "",
    amountBMin: "",
    deadline: "",
  });
  const write = useToastWrite(contractName);

  const remove = () =>
    write(
      {
        functionName: "removeLiquidity",
        args: [
          f.tokenA as Address,
          f.tokenB as Address,
          parseUnits(f.liquidity, 18),
          parseUnits(f.amountAMin, 18),
          parseUnits(f.amountBMin, 18),
          address as Address,
          BigInt(f.deadline),
        ],
      },
      {
        onBlockConfirmation: tx => {
          toast.dismiss();
          toast.success(
            <>
              <p>Liquidity removed ✅</p>
              <p className="break-all text-xs">{tx.transactionHash}</p>
            </>,
          );
        },
      },
    );

  return (
    <div className="card bg-base-200 p-4 space-y-2">
      <h3 className="font-bold">removeLiquidity</h3>
      {(["tokenA", "tokenB", "liquidity", "amountAMin", "amountBMin", "deadline"] as const).map(k => (
        <input
          key={k}
          className="input input-bordered w-full"
          placeholder={k}
          value={(f as any)[k]}
          onChange={e => sF({ ...f, [k]: e.target.value })}
        />
      ))}
      <button className="btn btn-primary w-full" onClick={remove}>
        remove
      </button>
    </div>
  );
};

/**
 * getAmountOut
 */
const SwapGetOut = () => {
  const [inp, setInp] = useState({ amountIn: "", reserveIn: "", reserveOut: "" });
  const shouldRead = Boolean(inp.amountIn && inp.reserveIn && inp.reserveOut);
  const { data } = useScaffoldReadContract(
    shouldRead
      ? {
          contractName,
          functionName: "getAmountOut",
          args: [parseUnits(inp.amountIn, 18), parseUnits(inp.reserveIn, 18), parseUnits(inp.reserveOut, 18)],
        }
      : {
          contractName,
          functionName: "getAmountOut",
          args: [undefined, undefined, undefined],
        },
  );

  return (
    <div className="card bg-base-200 p-4 space-y-2">
      <h3 className="font-bold">getAmountOut</h3>
      {(["amountIn", "reserveIn", "reserveOut"] as const).map(k => (
        <input
          key={k}
          className="input input-bordered w-full"
          placeholder={k}
          value={(inp as any)[k]}
          onChange={e => setInp({ ...inp, [k]: e.target.value })}
        />
      ))}
      {data !== undefined && <p>out: {formatUnits(data, 18)}</p>}
    </div>
  );
};

/**
 * swapExactTokensForTokens
 */
const SwapSwap = () => {
  const { address } = useAccount();
  const [f, sF] = useState({
    amountIn: "",
    amountOutMin: "",
    tokenIn: "",
    tokenOut: "",
    deadline: "",
  });
  const write = useScaffoldWriteContract(contractName).writeContractAsync;
  const approveTokens = useApproveTokens(swapAddr);

  const swap = async () => {
    if (!isAddress(f.tokenIn) || !isAddress(f.tokenOut)) {
      toast.error("Invalid token address");
      return;
    }

    const tokenInAddress = getAddress(f.tokenIn);
    const tokenOutAddress = getAddress(f.tokenOut);

    await approveTokens({
      tokenAContract: tokenInAddress,
      tokenBContract: tokenOutAddress,
      amountA: f.amountIn,
      amountB: "0",
    });

    await write({
      functionName: "swapExactTokensForTokens",
      args: [
        parseUnits(f.amountIn, 18),
        parseUnits(f.amountOutMin, 18),
        [tokenInAddress, tokenOutAddress],
        address as Address,
        BigInt(f.deadline),
      ],
    });

    toast.success(<>Swapped ✅</>);
  };

  return (
    <div className="card bg-base-200 p-4 space-y-2">
      <h3 className="font-bold">swapExactTokensForTokens</h3>
      {(["amountIn", "amountOutMin", "tokenIn", "tokenOut", "deadline"] as const).map(k => (
        <input
          key={k}
          className="input input-bordered w-full"
          placeholder={k}
          value={(f as any)[k]}
          onChange={e => sF({ ...f, [k]: e.target.value })}
        />
      ))}
      <button className="btn btn-primary w-full" onClick={swap}>
        swap
      </button>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*                                    PAGE                                    */
/* -------------------------------------------------------------------------- */
export default function Page() {
  return (
    <div className="flex flex-col items-center gap-10 py-10">
      <div className="flex flex-col lg:flex-row gap-6">
        <TokenClaim name="BOOKE" />
        <TokenClaim name="MIAMI" />
      </div>
      <div className="grid lg:grid-cols-6 gap-6 w-full max-w-7xl">
        <SwapGetPrice />
        <SwapGetLiquidity />
        <SwapAddLiquidity />
        <SwapRemoveLiquidity />
        <SwapGetOut />
        <SwapSwap />
      </div>
    </div>
  );
}
