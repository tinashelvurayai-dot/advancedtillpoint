import { Button, type ButtonProps } from "@/components/ui/button";
import { Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useVoice } from "@/hooks/use-voice";
import { toast } from "sonner";

interface VoiceMicButtonProps extends Omit<ButtonProps, "onClick"> {
  onFinalTranscript: (text: string) => void;
  onInterimTranscript?: (text: string) => void;
  continuous?: boolean;
  label?: string;
  compact?: boolean;
}

export function VoiceMicButton({
  onFinalTranscript,
  onInterimTranscript,
  continuous = false,
  label = "Voice",
  compact,
  className,
  variant = "outline",
  size = "sm",
  ...rest
}: VoiceMicButtonProps) {
  const { supported, listening, toggle } = useVoice({
    continuous,
    onFinal: onFinalTranscript,
    onInterim: onInterimTranscript,
  });

  if (!supported) {
    return (
      <Button
        {...rest}
        variant={variant}
        size={size}
        type="button"
        className={className}
        onClick={() => toast.error("Voice input isn't supported on this browser. Try Chrome or Edge.")}
      >
        <MicOff className="mr-2 h-4 w-4" /> {compact ? "" : label}
      </Button>
    );
  }

  return (
    <Button
      {...rest}
      type="button"
      variant={variant}
      size={size}
      onClick={toggle}
      className={cn(className, listening && "border-red-400 bg-red-50 text-red-700 hover:bg-red-100")}
      aria-pressed={listening}
    >
      <Mic className={cn("mr-2 h-4 w-4", listening && "animate-pulse")} />
      {compact ? (listening ? "•" : "") : (listening ? "Listening..." : label)}
    </Button>
  );
}
