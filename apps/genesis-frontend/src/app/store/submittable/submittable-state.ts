import { SubmitStatus } from "./submit-status";

export interface SubmittableState {
  submitStatus: SubmitStatus;
  submitErrorText: string;
}

export const initialSubmittableState: SubmittableState = {
  submitStatus: SubmitStatus.NotSubmitted,
  submitErrorText: ''
};

export function getInitialState() {
  return { ...initialSubmittableState };
}

export function getSubmittingState() {
  return {
    ...initialSubmittableState,
    submitStatus: SubmitStatus.Submitting
  }
}

export function getSuccessfulState() {
  return {
    ...initialSubmittableState,
    submitStatus: SubmitStatus.Successful,
  }
}

// eth_estimateGas has a very detailed error object with a helpful & short "reason" property
export function getFailureState(error: {message: string } | Error | Error & { reason: string}) {
  return {
    ...initialSubmittableState,
    submitStatus: SubmitStatus.Failure,
    submitErrorText: (error as { reason: string})?.reason || error.message || 'Unknown Error'
  }
}
