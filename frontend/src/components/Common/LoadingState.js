function LoadingState({ message = "加载中..." }) {
  return (
    <div className="loading-state" role="status" aria-live="polite">
      <div className="loading-spinner" />
      {message}
    </div>
  );
}

export default LoadingState;
