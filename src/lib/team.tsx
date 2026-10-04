import { createContext, useContext, useState, type ReactNode } from "react";
import { device } from "./storage";

interface TeamCtx {
  code: string;
  setCode: (c: string) => void;
}

const Ctx = createContext<TeamCtx>({ code: "", setCode: () => {} });

export function TeamProvider({ children }: { children: ReactNode }) {
  const [code, setCodeState] = useState(() => {
    // A QR or personal link may carry the team code (?k=) and the person's name (?n=),
    // so newcomers skip typing them.
    const params = new URLSearchParams(window.location.hash.split("?")[1] ?? "");
    const fromLink = params.get("k");
    const nameFromLink = params.get("n");
    if (nameFromLink) device.name = nameFromLink;
    if (fromLink) device.teamCode = fromLink;
    if (fromLink || nameFromLink) {
      // Drop both from the address bar and history; they stay in localStorage.
      // Runs before HashRouter mounts, so the router never sees them.
      params.delete("k");
      params.delete("n");
      const [path] = window.location.hash.split("?");
      const rest = params.toString();
      window.history.replaceState(
        window.history.state,
        "",
        window.location.pathname + path + (rest ? `?${rest}` : ""),
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
