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

export function getFailureState(errorText = '') {
  return {
    ...initialSubmittableState,
    submitStatus: SubmitStatus.Failure,
    submitErrorText: errorText
  }
}
