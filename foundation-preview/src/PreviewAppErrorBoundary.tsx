import { Component } from 'react';
import type { ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { hasError: boolean };

export class PreviewAppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="preview-access-state" role="alert" aria-labelledby="preview-startup-error-title">
          <h1 id="preview-startup-error-title">Preview could not open</h1>
          <p>
            This recovery screen does not clear or re-import saved records. Reload the Preview to try again.
          </p>
          <p>Diagnostic code: <code>PREVIEW-STARTUP-ERROR</code></p>
          <button type="button" onClick={() => window.location.reload()}>Reload Preview</button>
        </main>
      );
    }

    return this.props.children;
  }
}
