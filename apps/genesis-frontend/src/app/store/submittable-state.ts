import { SubmitStatus } from "./submit-status";

export interface SubmittableState {
  submitStatus: SubmitStatus;
  submitErrorText: string;
}

export const initialSubmittableState: SubmittableState = {
  submitStatus: SubmitStatus.NotSubmitted,
  submitErrorText: ''
};
