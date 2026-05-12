import { useEffect, useRef, useCallback, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type ConnectionStatus = "connecting" | "connected" | "disconnected" | "exited";

interface RemoteTerminalProps {
  open: boolean;
  onClose: () => void;
}

export function RemoteTerminal({ open, onClose }: RemoteTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");

  const sendStdin = useCallback((data: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const encoder = new TextEncoder();
    const encoded = encoder.encode(data);
    const frame = new Uint8Array(1 + encoded.length);
    frame[0] = 0x00;
    frame.set(encoded, 1);
    ws.send(frame);
  }, []);

  const sendResize = useCallback((cols: number, rows: number) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const frame = new Uint8Array(5);
    frame[0] = 0x01;
    frame[1] = (cols >> 8) & 0xff;
    frame[2] = cols & 0xff;
    frame[3] = (rows >> 8) & 0xff;
    frame[4] = rows & 0xff;
    ws.send(frame);
  }, []);

  // Setup terminal + WebSocket when dialog opens
  useEffect(() => {
    if (!open || !terminalRef.current) return;

    // Create xterm instance
    const term = new Terminal({
      cursorBlink: true,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      fontSize: 14,
      theme: {
        background: "#1a1b26",
        foreground: "#c0caf5",
        cursor: "#c0caf5",
        cursorAccent: "#1a1b26",
        selectionBackground: "#33467c",
        black: "#15161e",
        red: "#f7768e",
        green: "#9ece6a",
        yellow: "#e0af68",
        blue: "#7aa2f7",
        magenta: "#bb9af7",
        cyan: "#7dcfff",
        white: "#a9b1d6",
        brightBlack: "#414868",
        brightRed: "#f7768e",
        brightGreen: "#9ece6a",
        brightYellow: "#e0af68",
        brightBlue: "#7aa2f7",
        brightMagenta: "#bb9af7",
        brightCyan: "#7dcfff",
        brightWhite: "#c0caf5",
      },
      allowTransparency: true,
      scrollback: 5000,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    term.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Connect WebSocket
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/api/terminal/ws`;
    setStatus("connecting");

    const ws = new WebSocket(wsUrl);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("connected");
      // Send initial resize after connection
      const { cols, rows } = term;
      sendResize(cols, rows);
    };

    ws.onmessage = (event) => {
      if (typeof event.data === "string") {
        // Text message — check for exit status
        if (event.data.startsWith("status:exited:")) {
          const code = event.data.split(":")[2];
          term.write(`\r\n\n[Process exited with code ${code}]\r\n`);
          setStatus("exited");
        } else if (event.data.startsWith("error:")) {
          term.write(`\r\n\n[${event.data}]\r\n`);
          setStatus("disconnected");
        }
      } else if (event.data instanceof ArrayBuffer) {
        // Binary — stdout data
        term.write(new Uint8Array(event.data));
      }
    };

    ws.onclose = () => {
      if (status !== "exited") {
        setStatus("disconnected");
      }
    };

    ws.onerror = () => {
      term.write("\r\n\n[WebSocket error — connection failed]\r\n");
      setStatus("disconnected");
    };

    // Keyboard input → stdin
    const onDataDisposable = term.onData((data) => {
      sendStdin(data);
    });

    // Resize handling
    const handleResize = () => {
      fitAddon.fit();
      sendResize(term.cols, term.rows);
    };

    // Observe container resize
    resizeObserverRef.current = new ResizeObserver(handleResize);
    if (terminalRef.current) {
      resizeObserverRef.current.observe(terminalRef.current);
    }

    // Window resize
    window.addEventListener("resize", handleResize);

    // Cleanup
    return () => {
      onDataDisposable.dispose();
      window.removeEventListener("resize", handleResize);
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      ws.close();
      wsRef.current = null;
      term.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
      setStatus("disconnected");
    };
  }, [open, sendStdin, sendResize]); // eslint-disable-line react-hooks/exhaustive-deps

  const statusColors: Record<ConnectionStatus, string> = {
    connecting: "bg-yellow-500",
    connected: "bg-green-500",
    disconnected: "bg-red-500",
    exited: "bg-gray-500",
  };

  const statusLabels: Record<ConnectionStatus, string> = {
    connecting: "Connecting…",
    connected: "Connected",
    disconnected: "Disconnected",
    exited: "Exited",
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 py-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-medium">
              Remote Terminal
            </DialogTitle>
            <div className="flex items-center gap-2 mr-6">
              <span
                className={cn(
                  "inline-block h-2 w-2 rounded-full animate-pulse",
                  statusColors[status],
                )}
              />
              <span className="text-xs text-muted-foreground">
                {statusLabels[status]}
              </span>
            </div>
          </div>
        </DialogHeader>
        <div
          ref={terminalRef}
          className="flex-1 min-h-0 p-1 bg-[#1a1b26] rounded-b-lg overflow-hidden"
        />
      </DialogContent>
    </Dialog>
  );
}

export default RemoteTerminal;
