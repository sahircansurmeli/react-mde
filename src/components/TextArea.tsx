import * as React from "react";
import { classNames, ClassValue } from "../util/ClassNames";
import {
  CaretCoordinates,
  getCaretCoordinates
} from "../util/TextAreaCaretPosition";
import { Suggestion } from "../types";
import { insertText } from "../util/InsertTextAtPosition";
import { mod } from "../util/Math";
import { SuggestionsDropdown } from "./SuggestionsDropdown";
import {
  ButtonHTMLAttributes,
  DetailedHTMLFactory,
  TextareaHTMLAttributes
} from "react";
import { ComponentSimilarTo } from "../util/type-utils";
import { text } from "express";

export interface MentionState {
  status: "active" | "inactive" | "loading";
  /**
   * Selection start by the time the mention was activated
   */
  startPosition?: number;
  focusIndex?: number;
  caret?: CaretCoordinates;
  suggestions: Suggestion[];
  /**
   * The character that triggered the mention. Example: @
   */
  triggeredBy?: string;
}

export interface TextAreaState {
  mention: MentionState;
}

export interface TextAreaProps {
  classes?: ClassValue;
  suggestionsDropdownClasses?: ClassValue;
  value: string;
  onChange: (value: string) => void;
  refObject?: React.RefObject<HTMLTextAreaElement>;
  readOnly?: boolean;
  height?: number;
  heightUnits?: string;
  suggestionTriggerCharacters?: string[];
  suggestionsAutoplace?: boolean;
  loadSuggestions?: (
    text: string,
    triggeredBy: string
  ) => Promise<Suggestion[]>;

  onPaste: React.ClipboardEventHandler;
  onDrop: React.DragEventHandler;

  /**
   * Custom textarea component. "textAreaComponent" can be any React component which
   * props are a subset of the props of an HTMLTextAreaElement
   */
  textAreaComponent?: ComponentSimilarTo<
    HTMLTextAreaElement,
    TextareaHTMLAttributes<HTMLTextAreaElement>
  >;
  toolbarButtonComponent?: ComponentSimilarTo<
    HTMLButtonElement,
    ButtonHTMLAttributes<HTMLButtonElement>
  >;
  textAreaProps?: Partial<
    React.DetailedHTMLProps<
      React.TextareaHTMLAttributes<HTMLTextAreaElement>,
      HTMLTextAreaElement
    >
  >;
  /**
   * On keydown, the TextArea will trigger "onPossibleKeyCommand" as an opportunity for React-Mde to
   * execute a command. If a command is executed, React-Mde should return true, otherwise, false.
   */
  onPossibleKeyCommand?: (
    e: React.KeyboardEvent<HTMLTextAreaElement>
  ) => boolean;
}

export class TextArea extends React.Component<TextAreaProps, TextAreaState> {
  currentLoadSuggestionsPromise?: Promise<unknown> = Promise.resolve(undefined);

  /**
   * suggestionsPromiseIndex exists as a means to cancel what happens when the suggestions promise finishes loading.
   *
   * When the user is searching for suggestions, there is a promise that, when resolved, causes a re-render.
   * However, in case there is another promise to be resolved after the current one, it does not make sense to re-render
   * only to re-render again after the next one is complete.
   *
   * When there is a promise loading and the user cancels the suggestion, you don't want the status to go back to "active"
   * when the promise resolves.
   *
   * suggestionsPromiseIndex increments every time the mentions query
   */
  suggestionsPromiseIndex: number = 0;

  constructor(props) {
    super(props);
    this.state = { mention: { status: "inactive", suggestions: [] } };
  }

  suggestionsEnabled() {
    return (
      this.props.suggestionTriggerCharacters &&
      this.props.suggestionTriggerCharacters.length &&
      this.props.loadSuggestions
    );
  }

  getTextArea = (): HTMLTextAreaElement => {
    return this.props.refObject.current;
  };

  handleOnChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const { onChange } = this.props;
    onChange(event.target.value);
  };

  handleBlur = () => {
    const { mention } = this.state;
    if (mention) {
      this.setState({ mention: { status: "inactive", suggestions: [] } });
    }
  };

  startLoadingSuggestions = (text: string) => {
    const promiseIndex = ++this.suggestionsPromiseIndex;
    const { loadSuggestions } = this.props;
    this.currentLoadSuggestionsPromise = this.currentLoadSuggestionsPromise
      .then(() => loadSuggestions(text, this.state.mention.triggeredBy))
      .then(suggestions => {
        if (this.state.mention.status === "inactive") {
          // This means this promise resolved too late when the status has already been set to inactice
          return;
        } else if (this.suggestionsPromiseIndex === promiseIndex) {
          if (!suggestions || !suggestions.length) {
            this.setState({
              mention: {
                status: "inactive",
                suggestions: []
              }
            });
          } else {
            this.setState({
              mention: {
                ...this.state.mention,
                status: "active",
                suggestions,
                focusIndex: 0
              }
            });
          }
          this.suggestionsPromiseIndex = 0;
        }
        return Promise.resolve();
      });
  };

  loadEmptySuggestion = (target: HTMLTextAreaElement, key: string) => {
    const caret = getCaretCoordinates(target, key);
    this.startLoadingSuggestions("");
    this.setState({
      mention: {
        status: "loading",
        startPosition: target.selectionStart + 1,
        caret: caret,
        suggestions: [],
        triggeredBy: key
      }
    });
  };

  handleSuggestionSelected = (index: number) => {
    const { mention } = this.state;

    this.getTextArea().selectionStart = mention.startPosition - 1;
    const textForInsert = this.props.value.substr(
      this.getTextArea().selectionStart,
      this.getTextArea().selectionEnd - this.getTextArea().selectionStart
    );

    insertText(this.getTextArea(), mention.suggestions[index].value + " ");
    this.setState({
      mention: {
        status: "inactive",
        suggestions: []
      }
    });
  };

  handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (this.props.onPossibleKeyCommand) {
      const handled = this.props.onPossibleKeyCommand(event);
      if (handled) {
        event.preventDefault();
        // If the keydown resulted in a command being executed, we will just close the suggestions if they are open.
        // Resetting suggestionsPromiseIndex will cause any promise that is yet to be resolved to have no effect
        // when they finish loading.
        // TODO: The code below is duplicate, we need to clean this up
        this.suggestionsPromiseIndex = 0;
        this.setState({
          mention: {
            status: "inactive",
            suggestions: []
          }
        });
        return;
      }
    }

    if (!this.suggestionsEnabled()) {
      return;
    }

    const { key, shiftKey, currentTarget } = event;
    const { selectionStart } = currentTarget;
    const { mention } = this.state;

    switch (mention.status) {
      case "loading":
      case "active":
        if (
          key === "Escape" ||
          (key === "Backspace" &&
            selectionStart <= this.state.mention.startPosition)
        ) {
          // resetting suggestionsPromiseIndex will cause any promise that is yet to be resolved to have no effect
          // when they finish loading.
          this.suggestionsPromiseIndex = 0;
          this.setState({
            mention: {
              status: "inactive",
              suggestions: []
            }
          });
        } else if (
          mention.status === "active" &&
          (key === "ArrowUp" || key === "ArrowDown") &&
          !shiftKey
        ) {
          event.preventDefault();
          const focusDelta = key === "ArrowUp" ? -1 : 1;
          this.setState({
            mention: {
              ...mention,
              focusIndex: mod(
                mention.focusIndex + focusDelta,
                mention.suggestions.length
              )
            }
          });
        } else if (
          key === "Enter" &&
          mention.status === "active" &&
          mention.suggestions.length
        ) {
          event.preventDefault();
          this.handleSuggestionSelected(mention.focusIndex);
        }
        break;
      default:
      // Ignore
    }

    if (event.key === "Enter") {
      const { onChange } = this.props;
      const textArea = this.getTextArea();
      // Else if the cursor is between a word, move what's after to a new point in new line
      // Else if the cursor is at the end of the line, create a new empty point
      // Merge last two
      const currentLineIdx = textArea.value.slice(0, textArea.selectionStart).lastIndexOf("\n") + 1;
      let nextLineIdx = textArea.value.slice(currentLineIdx, textArea.value.length).indexOf("\n");
      nextLineIdx = nextLineIdx > 0 ? nextLineIdx + currentLineIdx : textArea.value.length;
      const currentLine = textArea.value.slice(currentLineIdx, nextLineIdx);

      if (textArea.selectionStart === currentLineIdx) {
        return;
      }

      // Unordered list
      if (currentLine.slice(0, 2) == "- ") {
        event.preventDefault();

        const beforeCursor = textArea.value.slice(currentLineIdx + 2, textArea.selectionStart);
        const selected = textArea.value.slice(textArea.selectionStart, textArea.selectionEnd);
        const afterCursor = textArea.value.slice(textArea.selectionEnd, nextLineIdx);

        // If the cursor is next to the point and empty afterwards, delete the current point
        if (beforeCursor.trim() === "" && afterCursor.trim() === "") {
          textArea.value = textArea.value.slice(0, currentLineIdx);
          onChange(textArea.value);
        }

        else {
          const currentSelection = textArea.selectionStart;
          textArea.value = textArea.value.slice(0, currentLineIdx) + `- ${beforeCursor}\n- ${afterCursor}` + textArea.value.slice(nextLineIdx);
          textArea.setSelectionRange(currentSelection + 3, currentSelection + 3);
          onChange(textArea.value);
        }

        return;
      }

      const enumMatch = currentLine.match(/^[0-9]+(?=\. )/);

      // Ordered list
      if (enumMatch) {
        event.preventDefault();

        const enumNumber = parseInt(enumMatch[0]);

        const beforeCursor = textArea.value.slice(currentLineIdx + enumMatch[0].length + 2, textArea.selectionStart);
        const selected = textArea.value.slice(textArea.selectionStart, textArea.selectionEnd);
        const afterCursor = textArea.value.slice(textArea.selectionEnd, nextLineIdx);

        // If the cursor is next to the point and empty afterwards, delete the current point
        if (beforeCursor.trim() === "" && afterCursor.trim() === "") {
          textArea.value = textArea.value.slice(0, currentLineIdx);
          onChange(textArea.value);
        }

        else {
          const currentSelection = textArea.selectionStart;
          const currentVal = textArea.value;
          const lines = currentVal.slice(currentLineIdx).split("\n");


          textArea.value = currentVal.slice(0, currentLineIdx);
          textArea.value += `${enumNumber}. ${beforeCursor}\n${enumNumber+1}. ${afterCursor}\n`;
          let i;
          for (i = 1; i < lines.length; i++) {
            const lineNumMatch = lines[i].match(/^[0-9]+(?=\. )/);
            if (!lineNumMatch) {
              break;
            }

            const lineNum = parseInt(lineNumMatch[0]);
            const newEnumStr = `${enumNumber+i+1}. `;
            textArea.value += `${newEnumStr}${lines[i].slice(newEnumStr.length)}\n`;
          }

          textArea.value += lines.slice(i).join("\n");

          const newEnumLength = (enumNumber+1).toString().length
          textArea.setSelectionRange(currentSelection + newEnumLength + 3, currentSelection + newEnumLength + 3);
          onChange(textArea.value);
        }
      }
    }
  };

  handleKeyUp = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const { key } = event;
    const { mention } = this.state;
    const { suggestionTriggerCharacters, value } = this.props;

    switch (mention.status) {
      case "loading":
      case "active":
        if (key === "Backspace") {
          const searchText = value.substr(
            mention.startPosition,
            this.getTextArea().selectionStart - mention.startPosition
          );

          this.startLoadingSuggestions(searchText);
          if (mention.status !== "loading") {
            this.setState({
              mention: {
                ...this.state.mention,
                status: "loading"
              }
            });
          }
        }
        break;
      case "inactive":
        if (key === "Backspace") {
          const prevChar = value.charAt(this.getTextArea().selectionStart - 1);
          const isAtMention = suggestionTriggerCharacters.includes(
            value.charAt(this.getTextArea().selectionStart - 1)
          );

          if (isAtMention) {
            this.loadEmptySuggestion(event.currentTarget, prevChar);
          }
        }
        break;
      default:
      // Ignore
    }
  };

  handleKeyPress = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const { suggestionTriggerCharacters, value } = this.props;
    const { mention } = this.state;
    const { key } = event;

    switch (mention.status) {
      case "loading":
      case "active":
        if (key === " ") {
          this.setState({
            mention: {
              ...this.state.mention,
              status: "inactive"
            }
          });

          return;
        }

        const searchText =
          value.substr(
            mention.startPosition,
            this.getTextArea().selectionStart - mention.startPosition
          ) + key;

        // In this case, the mentions box was open but the user typed something else
        this.startLoadingSuggestions(searchText);
        if (mention.status !== "loading") {
          this.setState({
            mention: {
              ...this.state.mention,
              status: "loading"
            }
          });
        }
        break;
      case "inactive":
        if (
          suggestionTriggerCharacters.indexOf(event.key) === -1 ||
          !/\s|\(|\[|^.{0}$/.test(
            value.charAt(this.getTextArea().selectionStart - 1)
          )
        ) {
          return;
        }

        this.loadEmptySuggestion(event.currentTarget, event.key);
        break;
    }
  };

  render() {
    const {
      classes,
      readOnly,
      textAreaProps,
      height,
      heightUnits,
      value,
      suggestionTriggerCharacters,
      loadSuggestions,
      suggestionsDropdownClasses,
      textAreaComponent,
      onPaste,
      onDrop
    } = this.props;

    const suggestionsEnabled =
      suggestionTriggerCharacters &&
      suggestionTriggerCharacters.length &&
      loadSuggestions;

    const { mention } = this.state;

    const TextAreaComponent = (textAreaComponent ||
      "textarea") as DetailedHTMLFactory<
        TextareaHTMLAttributes<HTMLTextAreaElement>,
        HTMLTextAreaElement
      >;

    const heightVal = height && heightUnits ? height + heightUnits : height;

    return (
      <div className="mde-textarea-wrapper">
        <TextAreaComponent
          className={classNames("mde-text", classes)}
          style={{ height: heightVal }}
          ref={this.props.refObject}
          readOnly={readOnly}
          value={value}
          data-testid="text-area"
          {...textAreaProps}
          onChange={event => {
            textAreaProps?.onChange?.(event);
            this.handleOnChange(event);
          }}
          onBlur={event => {
            textAreaProps?.onBlur?.(event);
            if (suggestionsEnabled) {
              this.handleBlur();
            }
          }}
          onKeyDown={event => {
            textAreaProps?.onKeyDown?.(event);
            this.handleKeyDown(event);
          }}
          onKeyUp={event => {
            textAreaProps?.onKeyUp?.(event);
            if (suggestionsEnabled) {
              this.handleKeyUp(event);
            }
          }}
          onKeyPress={event => {
            textAreaProps?.onKeyPress?.(event);
            if (suggestionsEnabled) {
              this.handleKeyPress(event);
            }
          }}
          onPaste={event => {
            textAreaProps?.onPaste?.(event);
            onPaste(event);
          }}
          onDragOver={event => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onDrop={event => {
            textAreaProps?.onDrop?.(event);
            onDrop(event);
            event.preventDefault();
          }}
        />
        {mention.status === "active" && mention.suggestions.length && (
          <SuggestionsDropdown
            classes={suggestionsDropdownClasses}
            caret={mention.caret}
            suggestions={mention.suggestions}
            onSuggestionSelected={this.handleSuggestionSelected}
            suggestionsAutoplace={this.props.suggestionsAutoplace}
            focusIndex={mention.focusIndex}
            textAreaRef={this.props.refObject}
          />
        )}
      </div>
    );
  }
}
