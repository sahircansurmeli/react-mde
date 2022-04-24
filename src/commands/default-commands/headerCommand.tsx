import * as React from "react";
import { Command } from "../command";
import { TextApi, TextState } from "../..";
import { selectWord } from "../../util/MarkdownUtil";
import { text } from "express";

function setHeader(initialState: TextState, api: TextApi, prefix: string) {
  // Adjust the selection to encompass the whole word if the caret is inside one
  const newSelectionRange = selectWord({
    text: initialState.text,
    selection: initialState.selection
  });
  const state1 = api.setSelectionRange(newSelectionRange);

  const currentLineIdx = state1.text.slice(0, state1.selection.start).lastIndexOf("\n") + 1;
  let nextLineIdx = state1.text.slice(currentLineIdx).indexOf("\n");
  nextLineIdx = nextLineIdx > 0 ? nextLineIdx + currentLineIdx : state1.text.length;

  let state2;

  if (state1.text.slice(currentLineIdx, currentLineIdx + prefix.length) === prefix) {
    api.setSelectionRange({
      start: currentLineIdx,
      end: currentLineIdx + prefix.length
    });
    state2 = api.replaceSelection("");
    api.setSelectionRange({
      start: state1.selection.start - prefix.length,
      end: state1.selection.end - prefix.length
    });
  }

  else {
    // Add the prefix to the selection
    state2 = api.replaceSelection(`${prefix}${state1.selectedText}`);
    // Adjust the selection to not contain the prefix
    api.setSelectionRange({
      start: state2.selection.end - state1.selectedText.length,
      end: state2.selection.end
    });
  }
}

export const headerCommand: Command = {
  buttonProps: { 
    "aria-label": "Add heading text",
    "title": "Add heading text"
  },
  execute: ({ initialState, textApi }) => {
    setHeader(initialState, textApi, "### ");
  }
};
