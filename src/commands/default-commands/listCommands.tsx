import * as React from "react";
import { Command } from "../../types";
import { TextApi, TextState } from "../../index";
import {
  getBreaksNeededForEmptyLineAfter,
  getBreaksNeededForEmptyLineBefore,
  selectWord
} from "../../util/MarkdownUtil";

export type AlterLineFunction = (line: string, index: number) => string;

/**
 * Inserts insertionString before each line
 */
export function insertBeforeEachLine(
  selectedText: string,
  insertBefore: string | AlterLineFunction
): { modifiedText: string; insertionLength: number } {
  const lines = selectedText.split(/\n/);

  const isAlreadyAList = lines.every((val, idx) => {
    if (lines.length > 1 && idx == lines.length-1 && !val) {
      return true;
    }

    return val.startsWith(typeof (insertBefore) === "string" ? insertBefore : insertBefore(val, idx))
  });

  let insertionLength = 0;

  const modifiedText = isAlreadyAList
    ? lines
      .map((item, index) => {
        if (typeof insertBefore === "string") {
          insertionLength -= insertBefore.length;
          return item.slice(insertBefore.length);
        } else if (typeof insertBefore === "function") {
          const insertionResult = insertBefore(item, index);
          insertionLength -= insertionResult.length;
          return item.slice(insertionResult.length);
        }
        throw Error("insertion is expected to be either a string or a function");
      })
      .join("\n")
    : lines
      .map((item, index) => {
        if (typeof insertBefore === "string") {
          insertionLength += insertBefore.length;
          return insertBefore + item;
        } else if (typeof insertBefore === "function") {
          const insertionResult = insertBefore(item, index);
          insertionLength += insertionResult.length;
          return insertBefore(item, index) + item;
        }
        throw Error("insertion is expected to be either a string or a function");
      })
      .join("\n");

  return { modifiedText, insertionLength };
}

export const makeList = (
  state0: TextState,
  api: TextApi,
  insertBefore: string | AlterLineFunction
) => {
  const currentLineIdx = state0.text.slice(0, state0.selection.start).lastIndexOf("\n") + 1;
  let nextLineIdx = state0.text.slice(state0.selection.end+1).indexOf("\n");
  nextLineIdx = nextLineIdx >= 0 ? nextLineIdx + currentLineIdx + 1: state0.text.length;

  const state1 = api.setSelectionRange({
    start: currentLineIdx,
    end: nextLineIdx
  });

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

  const modifiedText = insertBeforeEachLine(state1.selectedText, insertBefore);

  api.replaceSelection(
    `${breaksBefore}${modifiedText.modifiedText}${breaksAfter}`
  );

  // Specifically when the text has only one line, we can exclude the "- ", for example, from the selection
  const oneLinerOffset =
    state1.selectedText.indexOf("\n") === -1 ? modifiedText.insertionLength : 0;

  const selectionStart =
    state1.selection.start + breaksBeforeCount + oneLinerOffset;
  const selectionEnd =
    selectionStart + modifiedText.modifiedText.length - oneLinerOffset;

  // Adjust the selection to not contain the **
  api.setSelectionRange({
    start: selectionStart,
    end: selectionEnd
  });
};

export const unorderedListCommand: Command = {
  buttonProps: { "aria-label": "Add unordered list" },
  execute: ({ initialState, textApi }) => {
    makeList(initialState, textApi, "- ");
  }
};

export const orderedListCommand: Command = {
  buttonProps: { "aria-label": "Add ordered list" },
  execute: ({ initialState, textApi }) => {
    makeList(initialState, textApi, (item, index) => `${index + 1}. `);
  }
};

export const checkedListCommand: Command = {
  buttonProps: { "aria-label": "Add checked list" },
  execute: ({ initialState, textApi }) => {
    makeList(initialState, textApi, (item, index) => `- [ ] `);
  }
};
