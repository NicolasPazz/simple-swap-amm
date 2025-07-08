"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Address, formatUnits, parseUnits } from "viem";
import { getAddress } from "viem";
import { ethers } from "ethers";
import { useAccount } from "wagmi";
import { useWriteContract } from "wagmi";
import deployed from "~~/contracts/deployedContracts";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth/useScaffoldReadContract";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth/useScaffoldWriteContract";
import { useTransactor } from "~~/hooks/scaffold-eth";
import scaffoldConfig from "~~/scaffold.config";

const CHAIN_ID =
  Number(process.env.NEXT_PUBLIC_CHAIN_ID) || scaffoldConfig.targetNetworks[0].id;
const swapAddr = (deployed as Record<number, any>)[CHAIN_ID].SimpleSwap.address as Address;
const contractName = "SimpleSwap";
const defaultDeadline = Math.floor(Date.now() / 1000 + 60 * 60).toString();

/* ------------------------- TOKENS ------------------------- */
type TokenProps = { name: "BOOKE" | "MIAMI" };

const TokenClaim = ({ name }: TokenProps) => {
  const displayName =
    name === "BOOKE" ? "BOOKE (Bokita Coin)" : "MIAMI (General Coin)";
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
    <div className="card w-full max-w-md bg-base-100 border border-primary/20 shadow-lg p-6 space-y-3">
      <h2 className="text-xl font-bold text-primary-content">
        {displayName}
        <span className="block text-xs break-all text-neutral-400">{tokenAddr}</span>
      </h2>
      <input
        className="input input-bordered w-full"
        type="number"
        min="0"
        step="any"
        placeholder="Amount to mint"
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
  const writeTx = useTransactor();

  return async ({ tokenAContract, tokenBContract, amountA, amountB }: ApproveTokensProps) => {
    await writeTx(() =>
      writeContractAsync({
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
      })
    );

    await writeTx(() =>
      writeContractAsync({
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
      })
    );
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
    body = <p className="break-all">price: {formatUnits(data, 18)}</p>;
  }

  return (
    <div className="card bg-base-100 border border-secondary/20 p-4 space-y-2 transition-shadow hover:shadow-xl">
      <h3 className="font-bold">Price</h3>
      <input
        className="input input-bordered w-full"
        placeholder="token A address"
        value={tokenA}
        onChange={e => setA(e.target.value)}
      />
      <input
        className="input input-bordered w-full"
        placeholder="token B address"
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
    body = <p className="break-all">liquidity: {formatUnits(data, 18)} LP</p>;
  }

  return (
    <div className="card bg-base-100 border border-secondary/20 p-4 space-y-2 transition-shadow hover:shadow-xl">
      <h3 className="font-bold">Liquidity</h3>
      <input
        className="input input-bordered w-full"
        placeholder="token A address"
        value={tokenA}
        onChange={e => setA(e.target.value)}
      />
      <input
        className="input input-bordered w-full"
        placeholder="token B address"
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
    deadline: defaultDeadline,
  });
  const [addErrors, setAddErrors] = useState<Record<string, string>>({});

  const approveTokens = useApproveTokens(swapAddr);
  const write = useScaffoldWriteContract(contractName).writeContractAsync;

  const handleAddChange = (key: string, value: string) => {
    sF(prev => ({ ...prev, [key]: value }));
    let msg = "";
    if (key === "tokenA" || key === "tokenB") {
      if (value && !ethers.utils.isAddress(value)) {
        msg = "Formato de dirección inválido";
      } else if (key === "tokenB" && value === f.tokenA) {
        msg = "Debe ser distinto de la otra dirección";
        setAddErrors(prev => ({ ...prev, tokenA: "Debe ser distinto de la otra dirección" }));
      } else if (key === "tokenA" && value === f.tokenB) {
        msg = "Debe ser distinto de la otra dirección";
        setAddErrors(prev => ({ ...prev, tokenB: "Debe ser distinto de la otra dirección" }));
      } else {
        if (key === "tokenB") setAddErrors(prev => ({ ...prev, tokenA: "" }));
        if (key === "tokenA") setAddErrors(prev => ({ ...prev, tokenB: "" }));
      }
    } else if (key === "amountADesired" || key === "amountBDesired") {
      if (value && Number(value) <= 0) msg = "Debe ser mayor a 0";
    } else if (key === "amountAMin") {
      const val = Number(value);
      if (val <= 0) msg = "Debe ser mayor a 0";
      else if (f.amountADesired && val > Number(f.amountADesired)) {
        msg = "Debe ser menor o igual a amountADesired";
      }
    } else if (key === "amountBMin") {
      const val = Number(value);
      if (val <= 0) msg = "Debe ser mayor a 0";
      else if (f.amountBDesired && val > Number(f.amountBDesired)) {
        msg = "Debe ser menor o igual a amountBDesired";
      }
    }
    setAddErrors(prev => ({ ...prev, [key]: msg }));
  };

  const add = async () => {
    if (!ethers.utils.isAddress(f.tokenA) || !ethers.utils.isAddress(f.tokenB)) {
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
    <div className="card bg-base-100 border border-secondary/20 p-4 space-y-2 transition-shadow hover:shadow-xl">
      <h3 className="font-bold">Add Liquidity</h3>
      {(["tokenA", "tokenB", "amountADesired", "amountBDesired", "amountAMin", "amountBMin", "deadline"] as const).map(k => (
        <div key={k} className="space-y-1">
          <input
            className="input input-bordered w-full hover:border-primary transition-colors"
            placeholder={{
              tokenA: "token A address",
              tokenB: "token B address",
              amountADesired: "desired amount A",
              amountBDesired: "desired amount B",
              amountAMin: "min amount A (slippage)",
              amountBMin: "min amount B (slippage)",
              deadline: "deadline (unix)",
            }[k]}
            value={(f as any)[k]}
            onChange={e => handleAddChange(k, e.target.value)}
          />
          {addErrors[k] && <small className="text-red-500">{addErrors[k]}</small>}
        </div>
      ))}
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
    deadline: defaultDeadline,
  });
  const [removeErrors, setRemoveErrors] = useState<Record<string, string>>({});
  const write = useToastWrite(contractName);

  const handleRemoveChange = (key: string, value: string) => {
    sF(prev => ({ ...prev, [key]: value }));
    let msg = "";
    if (key === "tokenA" || key === "tokenB") {
      if (value && !ethers.utils.isAddress(value)) {
        msg = "Formato de dirección inválido";
      } else if (key === "tokenB" && value === f.tokenA) {
        msg = "Debe ser distinto de la otra dirección";
      } else if (key === "tokenA" && value === f.tokenB) {
        msg = "Debe ser distinto de la otra dirección";
      }
    } else if (key === "liquidity" || key === "amountAMin" || key === "amountBMin") {
      if (value && Number(value) <= 0) msg = "Debe ser mayor a 0";
      if (key === "amountAMin" && f.liquidity && Number(value) > Number(f.liquidity)) {
        msg = `Rango válido: mínimo 0, máximo ${f.liquidity}`;
      }
      if (key === "amountBMin" && f.liquidity && Number(value) > Number(f.liquidity)) {
        msg = `Rango válido: mínimo 0, máximo ${f.liquidity}`;
      }
    }
    setRemoveErrors(prev => ({ ...prev, [key]: msg }));
  };

  const remove = () => {
    if (!ethers.utils.isAddress(f.tokenA) || !ethers.utils.isAddress(f.tokenB) || f.tokenA === f.tokenB) {
      toast.error("Invalid token address");
      return;
    }
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
  };

  return (
    <div className="card bg-base-100 border border-secondary/20 p-4 space-y-2 transition-shadow hover:shadow-xl">
      <h3 className="font-bold">Remove Liquidity</h3>
      {(["tokenA", "tokenB", "liquidity", "amountAMin", "amountBMin", "deadline"] as const).map(k => (
        <div key={k} className="space-y-1">
          <input
            className="input input-bordered w-full hover:border-primary transition-colors"
            placeholder={{
              tokenA: "token A address",
              tokenB: "token B address",
              liquidity: "lp tokens",
              amountAMin: "min amount A (slippage)",
              amountBMin: "min amount B (slippage)",
              deadline: "deadline (unix)",
            }[k]}
            value={(f as any)[k]}
            onChange={e => handleRemoveChange(k, e.target.value)}
          />
          {removeErrors[k] && <small className="text-red-500">{removeErrors[k]}</small>}
        </div>
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
    <div className="card bg-base-100 border border-secondary/20 p-4 space-y-2 transition-shadow hover:shadow-xl">
      <h3 className="font-bold">Amount Out</h3>
      {(["amountIn", "reserveIn", "reserveOut"] as const).map(k => (
        <input
          key={k}
          className="input input-bordered w-full hover:border-primary transition-colors"
          placeholder={{
            amountIn: "amount in",
            reserveIn: "reserve in",
            reserveOut: "reserve out",
          }[k]}
          value={(inp as any)[k]}
          onChange={e => setInp({ ...inp, [k]: e.target.value })}
        />
      ))}
      {data !== undefined && <p className="break-all">out: {formatUnits(data, 18)}</p>}
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
    deadline: defaultDeadline,
  });
  const [swapErrors, setSwapErrors] = useState<Record<string, string>>({});
  const write = useScaffoldWriteContract(contractName).writeContractAsync;
  const approveTokens = useApproveTokens(swapAddr);

  const handleSwapChange = (key: string, value: string) => {
    sF(prev => ({ ...prev, [key]: value }));
    let msg = "";
    if (key === "tokenIn" || key === "tokenOut") {
      if (value && !ethers.utils.isAddress(value)) {
        msg = "Formato de dirección inválido";
      } else if (key === "tokenOut" && value === f.tokenIn) {
        msg = "Debe ser distinto de la otra dirección";
        setSwapErrors(prev => ({ ...prev, tokenIn: "Debe ser distinto de la otra dirección" }));
      } else if (key === "tokenIn" && value === f.tokenOut) {
        msg = "Debe ser distinto de la otra dirección";
        setSwapErrors(prev => ({ ...prev, tokenOut: "Debe ser distinto de la otra dirección" }));
      } else {
        if (key === "tokenOut") setSwapErrors(prev => ({ ...prev, tokenIn: "" }));
        if (key === "tokenIn") setSwapErrors(prev => ({ ...prev, tokenOut: "" }));
      }
    } else if (key === "amountIn" || key === "amountOutMin") {
      if (value && Number(value) <= 0) msg = "Debe ser mayor a 0";
      if (key === "amountOutMin" && f.amountIn) {
        const suggested = Number(f.amountIn) * 0.95;
        if (Number(value) < suggested) {
          msg = `Rango válido: mínimo ${suggested}`;
        }
      }
    }
    setSwapErrors(prev => ({ ...prev, [key]: msg }));
  };

  const swap = async () => {
    if (!ethers.utils.isAddress(f.tokenIn) || !ethers.utils.isAddress(f.tokenOut)) {
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
    <div className="card bg-base-100 border border-secondary/20 p-4 space-y-2 transition-shadow hover:shadow-xl">
      <h3 className="font-bold">Swap</h3>
      {(["amountIn", "amountOutMin", "tokenIn", "tokenOut", "deadline"] as const).map(k => (
        <div key={k} className="space-y-1">
          <input
            className="input input-bordered w-full hover:border-primary transition-colors"
            placeholder={{
              amountIn: "amount in",
              amountOutMin: "min amount out (slippage)",
              tokenIn: "token in address",
              tokenOut: "token out address",
              deadline: "deadline (unix)",
            }[k]}
            value={(f as any)[k]}
            onChange={e => handleSwapChange(k, e.target.value)}
          />
          {swapErrors[k] && <small className="text-red-500">{swapErrors[k]}</small>}
        </div>
      ))}
      <button className="btn btn-primary w-full" onClick={swap}>
        swap
      </button>
    </div>
  );
};

/** LP Token balance */
const LPBalance = () => {
  const { address } = useAccount();
  const { data } = useScaffoldReadContract({
    contractName,
    functionName: "balanceOf",
    args: [address as Address],
    watch: true,
  });

  return (
    <div className="card bg-gradient-to-br from-secondary/40 to-primary/40 p-4 text-center">
      <h3 className="font-bold">Your LP Tokens</h3>
      <p className="text-lg break-all">{data ? formatUnits(data, 18) : "0"} LP</p>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*                                    PAGE                                    */
/* -------------------------------------------------------------------------- */
export default function Page() {
  return (
    <div className="flex flex-col items-center gap-10 py-10 bg-gradient-to-b from-base-200 to-base-100">
      <div className="flex flex-col lg:flex-row gap-6">
        <TokenClaim name="BOOKE" />
        <TokenClaim name="MIAMI" />
      </div>
      <LPBalance />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 w-full max-w-7xl">
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
