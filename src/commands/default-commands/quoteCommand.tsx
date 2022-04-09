import * as React from "react";
import { Command } from "../../types";
import {
  getBreaksNeededForEmptyLineAfter,
  getBreaksNeededForEmptyLineBefore,
  selectWord
} from "../../util/MarkdownUtil";

export const quoteCommand: Command = {
  buttonProps: { "aria-label": "Insert a quote" },
  execute: ({ initialState, textApi }) => {
    // Adjust the selection to encompass the whole word if the caret is inside one
    const newSelectionRange = selectWord({
      text: initialState.text,
      selection: initialState.selection
    });
    const state1 = textApi.setSelectionRange(newSelectionRange);

    const currentLineIdx = state1.text.slice(0, state1.selection.start).lastIndexOf("\n") + 1;
    let nextLineIdx = state1.text.slice(currentLineIdx).indexOf("\n");
    nextLineIdx = nextLineIdx > 0 ? nextLineIdx + currentLineIdx : state1.text.length;

    if (state1.text.slice(currentLineIdx, currentLineIdx + 2) === "> ") {
      textApi.setSelectionRange({
        start: currentLineIdx,
        end: currentLineIdx + 2
      });
      textApi.replaceSelection("");
      textApi.setSelectionRange({
        start: state1.selection.start - 2,
        end: state1.selection.end - 2
      });
    }

    else {
      const breaksBeforeCount = getBreaksNeededForEmptyLineBefore(
        state1.text,
        state1.selection.start
      );
      const breaksBefore = Array(breaksBeforeCount + 1).join("\n");

      const breaksAfterCount = getBreaksNeededForEmptyLineAfter(
        state1.text,
        state1.selection.end
      );
      const breaksAfter = Array(breaksAfterCount + 1).join("\n");

      // Replaces the current selection with the quote mark up
      textApi.replaceSelection(
        `${breaksBefore}> ${state1.selectedText}${breaksAfter}`
      );

      const selectionStart = state1.selection.start + breaksBeforeCount + 2;
      const selectionEnd = selectionStart + state1.selectedText.length;

      textApi.setSelectionRange({
        start: selectionStart,
        end: selectionEnd
      });
    }
  }
};
