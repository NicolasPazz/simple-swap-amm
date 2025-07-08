"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import { txToast } from "../components/TxToast";
import { Address, formatUnits, parseUnits, isAddress, getAddress } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import { useWriteContract } from "wagmi";
import deployed from "~~/contracts/deployedContracts";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth/useScaffoldReadContract";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth/useScaffoldWriteContract";
import scaffoldConfig from "~~/scaffold.config";

/**
 * Main application page. Provides utilities to mint test tokens, add/remove
 * liquidity, check prices and perform swaps against the SimpleSwap contract.
 */

const CHAIN_ID =
  Number(process.env.NEXT_PUBLIC_CHAIN_ID) || scaffoldConfig.targetNetworks[0].id;
const swapAddr = (deployed as Record<number, any>)[CHAIN_ID].SimpleSwap.address as Address;
const contractName = "SimpleSwap";
const getDefaultDeadline = () => (Math.floor(Date.now() / 1000) + 60 * 60).toString();

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
    if (!amount || Number(amount) <= 0) {
      txToast("error", "Amount must be greater than 0");
      return;
    }

    const raw = BigInt(amount);

    await writeContractAsync(
      {
        functionName: "mint",
        args: [raw],
      },
      {
        onBlockConfirmation: tx => {
          txToast("success", "Minted", tx.transactionHash);
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
        onChange={e => setAmount(e.target.value.replace(/,/g, "."))}
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
  const publicClient = usePublicClient({ chainId: CHAIN_ID });

  return async ({ tokenAContract, tokenBContract, amountA, amountB }: ApproveTokensProps) => {
    if (!publicClient) {
      txToast("error", "Public client unavailable");
      return;
    }
    const loadingA = txToast("loading", "Approving token A...");
    const txHashA = await writeContractAsync({
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
    await publicClient.waitForTransactionReceipt({ hash: txHashA });
    toast.dismiss(loadingA);
    txToast("success", "Token A approved", txHashA);
    if (parseFloat(amountB) > 0) {
      const loadingB = txToast("loading", "Approving token B...");
      const txHashB = await writeContractAsync({
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
      await publicClient.waitForTransactionReceipt({ hash: txHashB });
      toast.dismiss(loadingB);
      txToast("success", "Token B approved", txHashB);
    }
  };
};

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
  const [form, setForm] = useState({
    tokenA: "",
    tokenB: "",
    amountADesired: "",
    amountBDesired: "",
    amountAMin: "",
    amountBMin: "",
    deadline: getDefaultDeadline(),
  });
  const [addErrors, setAddErrors] = useState<Record<string, string>>({});

  const approveTokens = useApproveTokens(swapAddr);
  const { writeContractAsync: write, isMining } = useScaffoldWriteContract({ contractName });
  const [loading, setLoading] = useState(false);

  const handleAddChange = (key: string, value: string) => {
    if (key.includes("amount") && value) value = value.replace(/,/g, ".");
    setForm(prev => ({ ...prev, [key]: value }));
    let msg = "";
    if (key === "tokenA" || key === "tokenB") {
      if (value && !isAddress(value)) {
        msg = "Invalid address format";
      } else if (key === "tokenB" && value === form.tokenA) {
        msg = "Must be different from the other address";
      } else if (key === "tokenA" && value === form.tokenB) {
        msg = "Must be different from the other address";
      } else {
        if (key === "tokenB") setAddErrors(prev => ({ ...prev, tokenB: "" }));
        if (key === "tokenA") setAddErrors(prev => ({ ...prev, tokenA: "" }));
      }
    } else if (key === "amountADesired" || key === "amountBDesired") {
      if (value && Number(value) <= 0) msg = "Must be greater than 0";
    } else if (key === "amountAMin") {
      const val = Number(value);
      if (val <= 0) msg = "Must be greater than 0";
      else if (form.amountADesired && val > Number(form.amountADesired)) {
        msg = "Must be less than or equal to amountADesired";
      }
    } else if (key === "amountBMin") {
      const val = Number(value);
      if (val <= 0) msg = "Must be greater than 0";
      else if (form.amountBDesired && val > Number(form.amountBDesired)) {
        msg = "Must be less than or equal to amountBDesired";
      }
    } else if (key === "deadline") {
      if (Number(value) < Math.floor(Date.now() / 1000) + 30)
        msg = "Must be at least 30s from now";
    }
    setAddErrors(prev => ({ ...prev, [key]: msg }));
  };

  const add = async () => {
    if (!isAddress(form.tokenA) || !isAddress(form.tokenB)) {
      txToast("error", "Invalid token address");
      return;
    }

    const tokenAAddress = getAddress(form.tokenA);
    const tokenBAddress = getAddress(form.tokenB);

    setLoading(true);
    await approveTokens({
      tokenAContract: tokenAAddress,
      tokenBContract: tokenBAddress,
      amountA: form.amountADesired,
      amountB: form.amountBDesired,
    });

    await write(
      {
        functionName: "addLiquidity",
        args: [
          tokenAAddress,
          tokenBAddress,
          parseUnits(form.amountADesired, 18),
          parseUnits(form.amountBDesired, 18),
          parseUnits(form.amountAMin, 18),
          parseUnits(form.amountBMin, 18),
          address as Address,
          BigInt(form.deadline),
        ],
      },
      {
        onBlockConfirmation: tx => txToast("success", "Liquidity added", tx.transactionHash),
      },
    );
    setLoading(false);
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
            value={(form as any)[k]}
            onChange={e => handleAddChange(k, e.target.value)}
          />
          {addErrors[k] && <small className="text-red-500">{addErrors[k]}</small>}
        </div>
      ))}
      <button className="btn btn-primary w-full" disabled={loading || isMining} onClick={add}>
        {loading || isMining ? <span className="loading loading-spinner" /> : "add"}
      </button>
    </div>
  );
};

/**
 * removeLiquidity
 */
const SwapRemoveLiquidity = () => {
  const { address } = useAccount();
  const [form, setForm] = useState({
    tokenA: "",
    tokenB: "",
    liquidity: "",
    amountAMin: "",
    amountBMin: "",
    deadline: getDefaultDeadline(),
  });
  const [removeErrors, setRemoveErrors] = useState<Record<string, string>>({});
  const { writeContractAsync: write, isMining } = useScaffoldWriteContract({ contractName });
  const [loading, setLoading] = useState(false);

  const handleRemoveChange = (key: string, value: string) => {
    if (key.includes("amount") && value) value = value.replace(/,/g, ".");
    setForm(prev => ({ ...prev, [key]: value }));
    let msg = "";
    if (key === "tokenA" || key === "tokenB") {
      if (value && !isAddress(value)) {
        msg = "Invalid address format";
      } else if (key === "tokenB" && value === form.tokenA) {
        msg = "Must be different from the other address";
      } else if (key === "tokenA" && value === form.tokenB) {
        msg = "Must be different from the other address";
      }
    } else if (key === "liquidity" || key === "amountAMin" || key === "amountBMin") {
      if (value && Number(value) <= 0) msg = "Must be greater than 0";
      if (key === "amountAMin" && form.liquidity && Number(value) > Number(form.liquidity)) {
        msg = `Valid range: minimum 0, maximum ${form.liquidity}`;
      }
      if (key === "amountBMin" && form.liquidity && Number(value) > Number(form.liquidity)) {
        msg = `Valid range: minimum 0, maximum ${form.liquidity}`;
      }
    } else if (key === "deadline") {
      if (Number(value) < Math.floor(Date.now() / 1000) + 30)
        msg = "Must be at least 30s from now";
    }
    setRemoveErrors(prev => ({ ...prev, [key]: msg }));
  };

  const remove = async () => {
    if (!isAddress(form.tokenA) || !isAddress(form.tokenB) || form.tokenA === form.tokenB) {
      txToast("error", "Invalid token address");
      return;
    }
    setLoading(true);
    await write(
      {
        functionName: "removeLiquidity",
        args: [
          form.tokenA as Address,
          form.tokenB as Address,
          parseUnits(form.liquidity, 18),
          parseUnits(form.amountAMin, 18),
          parseUnits(form.amountBMin, 18),
          address as Address,
          BigInt(form.deadline),
        ],
      },
      {
        onBlockConfirmation: tx => {
          txToast("success", "Liquidity removed", tx.transactionHash);
        },
      },
    );
    setLoading(false);
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
            value={(form as any)[k]}
            onChange={e => handleRemoveChange(k, e.target.value)}
          />
          {removeErrors[k] && <small className="text-red-500">{removeErrors[k]}</small>}
        </div>
      ))}
      <button className="btn btn-primary w-full" disabled={loading || isMining} onClick={remove}>
        {loading || isMining ? <span className="loading loading-spinner" /> : "remove"}
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
  const [form, setForm] = useState({
    amountIn: "",
    amountOutMin: "",
    tokenIn: "",
    tokenOut: "",
    deadline: getDefaultDeadline(),
  });
  const [swapErrors, setSwapErrors] = useState<Record<string, string>>({});
  const { writeContractAsync: write, isMining } = useScaffoldWriteContract({ contractName });
  const [loading, setLoading] = useState(false);
  const approveTokens = useApproveTokens(swapAddr);
  const { data: priceData } = useScaffoldReadContract(
    form.tokenIn && form.tokenOut
      ? {
          contractName,
          functionName: "getPrice",
          args: [form.tokenIn as Address, form.tokenOut as Address],
          watch: true,
        }
      : {
          contractName,
          functionName: "getPrice",
          args: [undefined, undefined],
        },
  );

  const handleSwapChange = (key: string, value: string) => {
    if (key.includes("amount") && value) value = value.replace(/,/g, ".");
    setForm(prev => ({ ...prev, [key]: value }));
    let msg = "";
    if (key === "tokenIn" || key === "tokenOut") {
      if (value && !isAddress(value)) {
        msg = "Invalid address format";
      } else if (key === "tokenOut" && value === form.tokenIn) {
        msg = "Must be different from the other address";
      } else if (key === "tokenIn" && value === form.tokenOut) {
        msg = "Must be different from the other address";
      } else {
        if (key === "tokenOut") setSwapErrors(prev => ({ ...prev, tokenOut: "" }));
        if (key === "tokenIn") setSwapErrors(prev => ({ ...prev, tokenIn: "" }));
      }
    } else if (key === "amountIn" || key === "amountOutMin") {
      if (value && Number(value) <= 0) msg = "Must be greater than 0";
      if (key === "amountOutMin" && form.amountIn) {
        const price = priceData ? Number(formatUnits(priceData, 18)) : 0;
        const suggested = Number(form.amountIn) * price * 0.95;
        if (price > 0 && Number(value) < suggested) {
          msg = `Valid range: minimum ${suggested.toFixed(4)}`;
        }
      }
    } else if (key === "deadline") {
      if (Number(value) < Math.floor(Date.now() / 1000) + 30)
        msg = "Must be at least 30s from now";
    }
    setSwapErrors(prev => ({ ...prev, [key]: msg }));
  };

  const swap = async () => {
    if (!isAddress(form.tokenIn) || !isAddress(form.tokenOut)) {
      txToast("error", "Invalid token address");
      return;
    }

    const tokenInAddress = getAddress(form.tokenIn);
    const tokenOutAddress = getAddress(form.tokenOut);

    setLoading(true);
    await approveTokens({
      tokenAContract: tokenInAddress,
      tokenBContract: tokenOutAddress,
      amountA: form.amountIn,
      amountB: "0",
    });

    await write(
      {
        functionName: "swapExactTokensForTokens",
        args: [
          parseUnits(form.amountIn, 18),
          parseUnits(form.amountOutMin, 18),
          [tokenInAddress, tokenOutAddress],
          address as Address,
          BigInt(form.deadline),
        ],
      },
      {
        onBlockConfirmation: tx => txToast("success", "Swapped", tx.transactionHash),
      },
    );
    setLoading(false);
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
            value={(form as any)[k]}
            onChange={e => handleSwapChange(k, e.target.value)}
          />
          {swapErrors[k] && <small className="text-red-500">{swapErrors[k]}</small>}
        </div>
      ))}
      <button className="btn btn-primary w-full" disabled={loading || isMining} onClick={swap}>
        {loading || isMining ? <span className="loading loading-spinner" /> : "swap"}
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
