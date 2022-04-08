import * as React from "react";
import { Command } from "../../types";
import { selectWord } from "../../util/MarkdownUtil";

export const strikeThroughCommand: Command = {
  buttonProps: { "aria-label": "Add strikethrough text" },
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

    if (selectedText.substring(0, 2) === "~~" && selectedText.substring(selectedText.length-2, selectedText.length) === "~~") {
      state2 = textApi.replaceSelection(selectedText.substring(2, selectedText.length-2));
      textApi.setSelectionRange({
        start: s1.start,
        end: s1.end - 2
      });
    }

    else if (s1.start >= 2 && text.substring(s1.start - 2, s1.start) === "~~" && text.substring(s1.end, s1.end + 2) === "~~") {
      textApi.setSelectionRange({
        start: s1.start - 2,
        end: s1.end + 2
      });
      state2 = textApi.replaceSelection(state1.selectedText);
      textApi.setSelectionRange({
        start: state2.selection.start - state1.selectedText.length,
        end: state2.selection.end
      });
    }

    else {
      // Replaces the current selection with the strikethrough mark up
      state2 = textApi.replaceSelection(`~~${state1.selectedText}~~`);
      // Adjust the selection to not contain the ~~
      textApi.setSelectionRange({
        start: state2.selection.end - 2 - state1.selectedText.length,
        end: state2.selection.end - 2
      });
    }
  }
};
