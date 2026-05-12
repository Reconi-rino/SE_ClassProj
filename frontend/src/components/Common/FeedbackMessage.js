import { useEffect, useState } from "react";

function FeedbackMessage({ message, type = "error", duration = 0 }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => { setVisible(true); }, [message]);

  useEffect(() => {
    if (duration > 0 && message) {
      const t = setTimeout(() => setVisible(false), duration);
      return () => clearTimeout(t);
    }
  }, [message, duration]);

  if (!message || !visible) return null;

  return (
    <div className={`feedback feedback-${type}`} role="alert" onClick={() => setVisible(false)}>
      {message}
    </div>
  );
}

export default FeedbackMessage;
