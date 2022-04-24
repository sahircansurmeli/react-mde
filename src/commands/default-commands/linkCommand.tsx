import * as React from "react";
import { Command } from "../../types";
import { TextApi, TextState } from "../../index";
import { selectWord } from "../../util/MarkdownUtil";

export const linkCommand: Command = {
  buttonProps: {
    "aria-label": "Add a link",
    "title": "Add a link"
  },
  execute: ({ initialState, textApi }) => {
    // Adjust the selection to encompass the whole word if the caret is inside one
    const newSelectionRange = selectWord({
      text: initialState.text,
      selection: initialState.selection
    });
    const state1 = textApi.setSelectionRange(newSelectionRange);

    const s1 = state1.selection;
    const text = state1.text;
    const selectedText = state1.selectedText;

    let state2;

    if (selectedText.substring(0, 1) === "[" && selectedText.substring(selectedText.length - 6, selectedText.length) === "](url)") {
      state2 = textApi.replaceSelection(selectedText.substring(1, selectedText.length - 6));
      textApi.setSelectionRange({
        start: s1.start,
        end: s1.end - 6
      });
    }

    else if (s1.start >= 1 && text.substring(s1.start - 1, s1.start) === "[" && text.substring(s1.end, s1.end + 6) === "](url)") {
      textApi.setSelectionRange({
        start: s1.start - 1,
        end: s1.end + 6
      });
      state2 = textApi.replaceSelection(state1.selectedText);
      textApi.setSelectionRange({
        start: state2.selection.start - state1.selectedText.length,
        end: state2.selection.end
      });
    }

    else {
      // Replaces the current selection with the bold mark up
      state2 = textApi.replaceSelection(`[${state1.selectedText}](url)`);
      // Adjust the selection to not contain the **
      textApi.setSelectionRange({
        start: state2.selection.end - 6 - state1.selectedText.length,
        end: state2.selection.end - 6
      });
    }
  },
  handleKeyCommand: e => (e.ctrlKey || e.metaKey) && e.key == "k"
};
