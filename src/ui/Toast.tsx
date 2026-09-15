import { useUiStore } from '../store/uiStore';

export function Toast() {
  const message = useUiStore((s) => s.toast);
  if (!message) return null;
  return <div className="toast" role="status">{message}</div>;
}
