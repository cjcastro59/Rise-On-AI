"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

interface AIReportErrorBoundaryProps {
  children: ReactNode;
  className?: string;
}

interface AIReportErrorBoundaryState {
  hasError: boolean;
  message: string | null;
}

export default class AIReportErrorBoundary extends Component<
  AIReportErrorBoundaryProps,
  AIReportErrorBoundaryState
> {
  state: AIReportErrorBoundaryState = {
    hasError: false,
    message: null,
  };

  static getDerivedStateFromError(error: Error): AIReportErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || "The AI report could not be displayed.",
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[AIReportErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className={`rounded-2xl border border-[#F4A6A6]/40 bg-[#F4A6A6]/10 p-5 ${this.props.className ?? ""}`}>
          <p className="text-sm font-poppins font-semibold text-[#9B3A1E]">
            AI report unavailable
          </p>
          <p className="mt-2 text-xs font-inter leading-relaxed text-dark-text/60">
            {this.state.message}
          </p>
          <p className="mt-2 text-[11px] font-inter leading-relaxed text-dark-text/40">
            The rest of the analysis remains available.
          </p>
        </div>
      );
    }

    return <div className={this.props.className}>{this.props.children}</div>;
  }
}
