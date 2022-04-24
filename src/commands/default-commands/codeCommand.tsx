import * as React from "react";
import { Command } from "../../types";
import {
  getBreaksNeededForEmptyLineAfter,
  getBreaksNeededForEmptyLineBefore,
  selectWord
} from "../../util/MarkdownUtil";

export const codeCommand: Command = {
  buttonProps: { 
    "aria-label": "Add code",
    "title": "Add code"
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

    // when there's no breaking line
    if (selectedText.indexOf("\n") === -1) {
      if (selectedText.substring(0, 1) === "\`" && selectedText.substring(selectedText.length - 1, selectedText.length) === "\`") {
        state2 = textApi.replaceSelection(selectedText.substring(1, selectedText.length - 1));
        textApi.setSelectionRange({
          start: s1.start,
          end: s1.end - 1
        });
      }

      else if (s1.start >= 1 && text.substring(s1.start - 1, s1.start) === "\`" && text.substring(s1.end, s1.end + 1) === "\`") {
        textApi.setSelectionRange({
          start: s1.start - 1,
          end: s1.end + 1
        });
        state2 = textApi.replaceSelection(state1.selectedText);
        textApi.setSelectionRange({
          start: state2.selection.start - state1.selectedText.length,
          end: state2.selection.end
        });
      }

      else {
        textApi.replaceSelection(`\`${state1.selectedText}\``);
        // Adjust the selection to not contain the **

        const selectionStart = state1.selection.start + 1;
        const selectionEnd = selectionStart + state1.selectedText.length;

        textApi.setSelectionRange({
          start: selectionStart,
          end: selectionEnd
        });
      }
      return;
    }

    let charsBefore = selectedText.substring(0, 4) === "\`\`\`\n" ? 4
      : selectedText.substring(0, 3) === "\`\`\`" ? 3 : 0;

    let charsAfter = selectedText.substring(selectedText.length - 4, selectedText.length) === "\n\`\`\`" ? 4
      : selectedText.substring(selectedText.length - 3, selectedText.length) === "\`\`\`" ? 3 : 0;

    if (charsBefore > 0 && charsAfter > 0) {
      state2 = textApi.replaceSelection(selectedText.substring(charsBefore, selectedText.length - charsAfter));
      textApi.setSelectionRange({
        start: s1.start,
        end: s1.end - charsAfter
      });
      return;
    }

    charsBefore = s1.start >= 4 && text.substring(s1.start - 4, s1.start) === "\`\`\`\n" ? 4
      : s1.start >= 3 && text.substring(s1.start - 3, s1.start) === "\`\`\`" ? 3 : 0;

    charsAfter = text.substring(s1.end, s1.end + 4) === "\n\`\`\`" ? 4
      : text.substring(s1.end, s1.end + 3) === "\`\`\`" ? 3 : 0;

    if (charsBefore > 0 && charsAfter > 0) {
      textApi.setSelectionRange({
        start: s1.start - charsBefore,
        end: s1.end + charsAfter
      });
      state2 = textApi.replaceSelection(state1.selectedText);
      textApi.setSelectionRange({
        start: state2.selection.start - state1.selectedText.length,
        end: state2.selection.end
      });
      return;
    }

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

    textApi.replaceSelection(
      `${breaksBefore}\`\`\`\n${state1.selectedText}\n\`\`\`${breaksAfter}`
    );

    const selectionStart = state1.selection.start + breaksBeforeCount + 4;
    const selectionEnd = selectionStart + state1.selectedText.length;

    textApi.setSelectionRange({
      start: selectionStart,
      end: selectionEnd
    });
  }
};
