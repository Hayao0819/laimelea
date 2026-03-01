import { useCallback, useState } from "react";

export function useSnackbar() {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");

  const show = useCallback((msg: string) => {
    setMessage(msg);
    setVisible(true);
  }, []);

  const dismiss = useCallback(() => setVisible(false), []);

  return { visible, message, show, dismiss };
}
