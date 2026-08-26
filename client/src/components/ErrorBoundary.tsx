import { AlertTriangle, Home, RotateCcw } from "lucide-react";
import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("NIU client boundary recovered from an application error.", error);
  }

  retry = () => this.setState({ hasError: false });

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-canvas p-8 text-ink">
          <div className="flex w-full max-w-2xl flex-col items-center p-8 text-center">
            <AlertTriangle
              size={48}
              className="mb-6 shrink-0 text-wine"
            />

            <h2 className="font-serif text-3xl">NIU needs a quick refresh.</h2>

            <p className="mt-3 max-w-xl leading-7 text-ink/65">Your protected learning records and account access have not been changed. You can safely try again or return to the NIU home page.</p>

            <div className="mt-7 flex flex-wrap justify-center gap-3">
            <button onClick={this.retry} className="button-primary">
              <RotateCcw size={16} />
              Try again
            </button>
            <a href="/" className="button-secondary"><Home size={16} /> Return home</a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
