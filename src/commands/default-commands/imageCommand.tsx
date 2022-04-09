import * as React from "react";
import { Command } from "../command";
import { selectWord } from "../../util/MarkdownUtil";

export const imageCommand: Command = {
  buttonProps: { "aria-label": "Add image" },
  execute: ({ initialState, textApi }) => {
    // Replaces the current selection with the whole word selected
    const state1 = textApi.setSelectionRange(
      selectWord({
        text: initialState.text,
        selection: initialState.selection
      })
    );

    const s1 = state1.selection;
    const text = state1.text;
    const selectedText = state1.selectedText;

    let state2;

    if (selectedText.substring(0, 4) === "![](" && selectedText.substring(selectedText.length - 1, selectedText.length) === ")") {
      state2 = textApi.replaceSelection(selectedText.substring(4, selectedText.length - 1));
      textApi.setSelectionRange({
        start: s1.start,
        end: s1.end - 1
      });
    }

    else if (s1.start >= 4 && text.substring(s1.start - 4, s1.start) === "![](" && text.substring(s1.end, s1.end + 1) === ")") {
      textApi.setSelectionRange({
        start: s1.start - 4,
        end: s1.end + 1
      });
      state2 = textApi.replaceSelection(state1.selectedText);
      textApi.setSelectionRange({
        start: state2.selection.start - state1.selectedText.length,
        end: state2.selection.end
      });
    }

    else {
      // Replaces the current selection with the image
      const imageTemplate = state1.selectedText;
      textApi.replaceSelection(`![](${imageTemplate})`);
      // Adjust the selection to not contain the **
      textApi.setSelectionRange({
        start: state1.selection.start + 4,
        end: state1.selection.start + 4 + imageTemplate.length
      });
    }
  }
};
