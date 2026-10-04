import { createContext, useContext, useState, type ReactNode } from "react";
import { device } from "./storage";

interface TeamCtx {
  code: string;
  setCode: (c: string) => void;
}

const Ctx = createContext<TeamCtx>({ code: "", setCode: () => {} });

export function TeamProvider({ children }: { children: ReactNode }) {
  const [code, setCodeState] = useState(() => {
    // A QR link may carry the team code (?k=...) so newcomers skip typing it.
    const fromLink = new URLSearchParams(
      window.location.hash.split("?")[1] ?? "",
    ).get("k");
    if (fromLink) {
      device.teamCode = fromLink;
      // Drop the code from the address bar and history; it stays in localStorage.
      // Runs before HashRouter mounts, so the router never sees ?k=.
      const cleaned = window.location.hash
        .replace(/([?&])k=[^&]*&?/, "$1")
        .replace(/[?&]$/, "");
      window.history.replaceState(
        window.history.state,
        "",
        window.location.pathname + cleaned,
      );
    }
    return fromLink ?? device.teamCode;
  });
  const setCode = (c: string) => {
    device.teamCode = c;
    setCodeState(c);
  };
  return <Ctx.Provider value={{ code, setCode }}>{children}</Ctx.Provider>;
}

export const useTeam = () => useContext(Ctx);
