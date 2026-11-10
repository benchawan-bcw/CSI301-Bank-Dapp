import { useState, useEffect, useCallback } from "react";
import { BrowserProvider, Contract, formatEther, parseEther } from "ethers"; // ethers v6

const BANK_ABI = [
  "function deposit() payable",
  "function withdraw(uint256 amount)",
  "function getBalance() view returns (uint256)",
  "event Deposited(address indexed account, uint256 amount)",
  "event Withdrawn(address indexed account, uint256 amount)",
];

const STUDENT_ID = "66066266";
const STUDENT_NAME = "เบญจวรรณ พูลทรัพย์";

const short = (a) => (a ? `${a.slice(0, 6)}...${a.slice(-4)}` : "");

const css = `
@import url("https://fonts.googleapis.com/css2?family=Prompt:wght@400;500;600&display=swap");

:root{
  --mint:#9BCEC1;
  --blue:#67A2C5;
  --cream:#FFEBD3;
  --peach:#FFB6A6;
  --ink:#24394B;
  --white:#FFFBF5;
}
*{box-sizing:border-box}
body{margin:0}
.bank{
  min-height:100vh;
  background:var(--cream);
  color:var(--ink);
  font-family:"Prompt","Noto Sans Thai",system-ui,sans-serif;
  padding:32px 20px 56px;
}
.wrap{max-width:960px;margin:0 auto}

.top{
  display:flex;align-items:center;justify-content:space-between;
  gap:16px;flex-wrap:wrap;margin-bottom:28px;
}
.brand{font-size:26px;font-weight:600;margin:0;letter-spacing:.2px}
.brand small{display:block;font-size:14px;font-weight:400;opacity:.75;margin-top:2px}

.btn{
  font:inherit;font-weight:500;color:var(--ink);
  border:2px solid var(--ink);border-radius:12px;
  padding:11px 20px;cursor:pointer;background:var(--peach);
  transition:transform .12s;
}
.btn:hover:not(:disabled){transform:translateY(-2px)}
.btn:focus-visible,.input:focus-visible,.tab:focus-visible{outline:3px solid var(--blue);outline-offset:2px}
.btn:disabled{opacity:.45;cursor:not-allowed}
.btn.blue{background:var(--blue)}
.btn.mint{background:var(--mint)}
.wallet{
  display:flex;align-items:center;gap:10px;
  background:var(--white);border:2px solid var(--ink);border-radius:12px;padding:9px 16px;
  font-weight:500;
}
.dot{width:10px;height:10px;border-radius:50%;background:var(--mint);border:2px solid var(--ink)}

.student{
  display:flex;gap:8px 28px;flex-wrap:wrap;
  background:var(--peach);border:2px solid var(--ink);border-radius:14px;
  padding:12px 18px;margin-bottom:20px;font-size:15px;
}
.student b{font-weight:600;margin-right:6px}

.grid{display:grid;grid-template-columns:5fr 6fr;gap:20px}
@media (max-width:760px){.grid{grid-template-columns:1fr}}

.card{
  border:2px solid var(--ink);border-radius:20px;padding:24px;
  background:var(--white);
}
.card h2{margin:0 0 6px;font-size:18px;font-weight:600}
.hint{margin:0 0 16px;font-size:14px;opacity:.75}

.balance{background:var(--mint)}
.amount{font-size:52px;font-weight:600;line-height:1.1;margin:14px 0 4px;word-break:break-all}
.amount span{font-size:22px;font-weight:500;margin-left:6px}
.unit{font-size:14px;opacity:.8;margin-bottom:18px}

.contract{background:var(--blue)}
.row{display:flex;gap:10px;flex-wrap:wrap}
.input{
  font:inherit;color:var(--ink);flex:1;min-width:0;
  border:2px solid var(--ink);border-radius:12px;padding:11px 14px;
  background:var(--white);
}
.input::placeholder{color:var(--ink);opacity:.5}

.tabs{display:flex;gap:8px;margin-bottom:16px}
.tab{
  font:inherit;font-weight:500;color:var(--ink);cursor:pointer;
  border:2px solid var(--ink);border-radius:12px;padding:8px 18px;background:var(--white);
}
.tab[aria-selected="true"]{background:var(--peach)}

.msg{
  margin-top:16px;border:2px solid var(--ink);border-radius:12px;
  padding:10px 14px;font-size:14px;word-break:break-word;background:var(--cream);
}
.msg.err{background:var(--peach)}

.log{list-style:none;margin:0;padding:0}
.log li{
  display:flex;justify-content:space-between;gap:12px;
  padding:10px 0;border-bottom:2px solid var(--cream);font-size:14px;
}
.log li:last-child{border-bottom:0}
.empty{font-size:14px;opacity:.75;margin:0}

@media (prefers-reduced-motion:reduce){.btn{transition:none}}
`;

export default function App() {
  const [account, setAccount] = useState("");
  const [signer, setSigner] = useState(null);
  const [contractAddr, setContractAddr] = useState(
    () => localStorage.getItem("bank_addr") || ""
  );
  const [contract, setContract] = useState(null);
  const [balance, setBalance] = useState(null); // string (ETH)
  const [tab, setTab] = useState("deposit");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState({ text: "", error: false });
  const [history, setHistory] = useState([]);

  const say = (text, error = false) => setStatus({ text, error });

  /* ---------- 1) เชื่อมต่อ MetaMask ---------- */
  const connectWallet = useCallback(async () => {
    if (!window.ethereum) {
      say("ไม่พบ MetaMask กรุณาติดตั้งส่วนขยาย MetaMask ก่อน", true);
      return;
    }
    try {
      const provider = new BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const s = await provider.getSigner();
      setSigner(s);
      setAccount(await s.getAddress());
      say("เชื่อมต่อ MetaMask สำเร็จ");
    } catch (e) {
      say(e?.info?.error?.message || e?.shortMessage || e.message, true);
    }
  }, []);

  // เปลี่ยนบัญชี / เปลี่ยนเครือข่ายใน MetaMask
  useEffect(() => {
    if (!window.ethereum) return;
    const reset = () => {
      setSigner(null);
      setAccount("");
      setContract(null);
      setBalance(null);
      say("บัญชีหรือเครือข่ายเปลี่ยนแล้ว กรุณาเชื่อมต่อใหม่");
    };
    window.ethereum.on("accountsChanged", reset);
    window.ethereum.on("chainChanged", reset);
    return () => {
      window.ethereum.removeListener("accountsChanged", reset);
      window.ethereum.removeListener("chainChanged", reset);
    };
  }, []);

  /* ---------- 2) เชื่อมต่อ Smart Contract ---------- */
  const connectContract = async () => {
    if (!signer) return say("กรุณาเชื่อมต่อ MetaMask ก่อน", true);
    const addr = contractAddr.trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(addr))
      return say("รูปแบบ Contract Address ไม่ถูกต้อง", true);
    try {
      setBusy(true);
      const code = await signer.provider.getCode(addr);
      if (code === "0x")
        return say("ไม่พบ Smart Contract ที่ address นี้ในเครือข่ายปัจจุบัน", true);
      const c = new Contract(addr, BANK_ABI, signer);
      setContract(c);
      localStorage.setItem("bank_addr", addr);
      say("เชื่อมต่อ Smart Contract สำเร็จ");
      await checkBalance(c);
    } catch (e) {
      say(e?.shortMessage || e.message, true);
    } finally {
      setBusy(false);
    }
  };

  /* ---------- 3) Check Balance ---------- */
  const checkBalance = async (c = contract) => {
    if (!c) return say("กรุณาเชื่อมต่อ Smart Contract ก่อน", true);
    try {
      const wei = await c.getBalance();
      setBalance(formatEther(wei));
    } catch (e) {
      say(e?.shortMessage || e.message, true);
    }
  };

  /* ---------- 4) Deposit / Withdraw ---------- */
  const validAmount = () => {
    if (!contract) return say("กรุณาเชื่อมต่อ Smart Contract ก่อน", true), null;
    try {
      const wei = parseEther(amount || "0");
      if (wei <= 0n) throw new Error();
      return wei;
    } catch {
      say("กรุณากรอกจำนวน ETH ที่มากกว่า 0", true);
      return null;
    }
  };

  const submit = async () => {
    const wei = validAmount();
    if (wei === null) return;
    try {
      setBusy(true);
      say("กำลังรอการยืนยันใน MetaMask...");
      const tx =
        tab === "deposit"
          ? await contract.deposit({ value: wei })
          : await contract.withdraw(wei);
      say(`ส่งธุรกรรมแล้ว รอการยืนยันบนบล็อกเชน (${short(tx.hash)})`);
      await tx.wait();
      setHistory((h) =>
        [{ type: tab, amount, hash: tx.hash }, ...h].slice(0, 6)
      );
      say(tab === "deposit" ? "ฝากเงินสำเร็จ" : "ถอนเงินสำเร็จ");
      setAmount("");
      await checkBalance();
    } catch (e) {
      const reason =
        e?.reason ||
        e?.info?.error?.message ||
        e?.shortMessage ||
        e.message;
      say(`ทำรายการไม่สำเร็จ: ${reason}`, true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bank">
      <style>{css}</style>
      <div className="wrap">
        <header className="top">
          <h1 className="brand">
            ธนาคาร DApp
            <small>ฝาก ถอน และเช็คยอดเงินบน Smart Contract</small>
          </h1>
          {account ? (
            <div className="wallet">
              <span className="dot" />
              {short(account)}
            </div>
          ) : (
            <button className="btn" onClick={connectWallet}>
              เชื่อมต่อ MetaMask
            </button>
          )}
        </header>

        <div className="student">
          <span><b>รหัสนักศึกษา</b>{STUDENT_ID}</span>
          <span><b>ชื่อ-สกุล</b>{STUDENT_NAME}</span>
        </div>

        <div className="grid">
          {/* ยอดเงิน */}
          <section className="card balance" aria-live="polite">
            <h2>ยอดเงินของคุณ</h2>
            <div className="amount">
              {balance === null ? "-" : Number(balance).toLocaleString("en-US", { maximumFractionDigits: 6 })}
              <span>ETH</span>
            </div>
            <div className="unit">
              {balance === null
                ? "เชื่อมต่อ Smart Contract เพื่อดูยอด"
                : "ยอดที่ฝากไว้ใน Smart Contract"}
            </div>
            <button
              className="btn"
              onClick={() => checkBalance()}
              disabled={!contract || busy}
            >
              เช็คยอดเงิน
            </button>
          </section>

          {/* เชื่อมต่อ Contract */}
          <section className="card contract">
            <h2>Smart Contract</h2>
            <p className="hint">วาง address ที่ได้จากการ Deploy ใน Remix</p>
            <div className="row">
              <input
                className="input"
                placeholder="0x..."
                value={contractAddr}
                onChange={(e) => setContractAddr(e.target.value)}
                aria-label="Contract address"
              />
              <button
                className="btn mint"
                onClick={connectContract}
                disabled={!account || busy}
              >
                {contract ? "เชื่อมต่อใหม่" : "เชื่อมต่อ"}
              </button>
            </div>
            {contract && (
              <div className="msg">เชื่อมต่อกับ {short(contractAddr)} แล้ว</div>
            )}
          </section>

          {/* ฝาก / ถอน */}
          <section className="card" style={{ gridColumn: "1 / -1" }}>
            <div className="tabs" role="tablist">
              <button
                className="tab"
                role="tab"
                aria-selected={tab === "deposit"}
                onClick={() => setTab("deposit")}
              >
                ฝากเงิน
              </button>
              <button
                className="tab"
                role="tab"
                aria-selected={tab === "withdraw"}
                onClick={() => setTab("withdraw")}
              >
                ถอนเงิน
              </button>
            </div>
            <div className="row">
              <input
                className="input"
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                placeholder="จำนวน ETH เช่น 0.05"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                aria-label="จำนวน ETH"
              />
              <button
                className="btn blue"
                onClick={submit}
                disabled={!contract || busy}
              >
                {busy ? "กำลังดำเนินการ..." : tab === "deposit" ? "ฝากเงิน" : "ถอนเงิน"}
              </button>
            </div>

            {status.text && (
              <div className={`msg ${status.error ? "err" : ""}`} role="status">
                {status.text}
              </div>
            )}

            <h2 style={{ marginTop: 24 }}>รายการล่าสุด</h2>
            {history.length === 0 ? (
              <p className="empty">ยังไม่มีรายการในเซสชันนี้</p>
            ) : (
              <ul className="log">
                {history.map((h) => (
                  <li key={h.hash}>
                    <span>{h.type === "deposit" ? "ฝาก" : "ถอน"} {h.amount} ETH</span>
                    <span>{short(h.hash)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
