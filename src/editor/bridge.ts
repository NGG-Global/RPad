/** Small bridge so panels outside the editor (course reference) can insert code at the cursor. */
export const editorBridge: { insert: ((text: string) => void) | null } = { insert: null };
