"use client";

import { SpinnerIcon } from "@phosphor-icons/react";
import {
	MDXEditor,
	headingsPlugin,
	listsPlugin,
	quotePlugin,
	thematicBreakPlugin,
	markdownShortcutPlugin,
	linkPlugin,
	linkDialogPlugin,
	toolbarPlugin,
	BoldItalicUnderlineToggles,
	BlockTypeSelect,
	ListsToggle,
	CreateLink,
	InsertThematicBreak,
	UndoRedo,
	type MDXEditorMethods,
} from "@mdxeditor/editor";
import "@mdxeditor/editor/style.css";
import { forwardRef } from "react";

interface MarkdownEditorProps {
	markdown: string;
	onChange?: (markdown: string) => void;
	placeholder?: string;
	readOnly?: boolean;
	className?: string;
}

export const MarkdownEditor = forwardRef<MDXEditorMethods, MarkdownEditorProps>(
	({ markdown, onChange, placeholder, readOnly = false, className }, ref) => {
		return (
			<MDXEditor
				ref={ref}
				markdown={markdown}
				onChange={onChange}
				placeholder={placeholder}
				readOnly={readOnly}
				className={`mdx-editor-wrapper ${className ?? ""}`}
				contentEditableClassName="prose dark:prose-invert max-w-none min-h-[300px] focus:outline-none"
				plugins={[
					headingsPlugin(),
					listsPlugin(),
					quotePlugin(),
					thematicBreakPlugin(),
					markdownShortcutPlugin(),
					linkPlugin(),
					linkDialogPlugin(),
					toolbarPlugin({
						toolbarContents: () => (
							<>
								<UndoRedo />
								<BlockTypeSelect />
								<BoldItalicUnderlineToggles />
								<ListsToggle />
								<CreateLink />
								<InsertThematicBreak />
							</>
						),
					}),
				]}
			/>
		);
	}
);

MarkdownEditor.displayName = "MarkdownEditor";

// Loading placeholder component
export function MarkdownEditorLoading() {
	return (
		<div className="flex items-center justify-center h-[300px] border rounded-md bg-muted/30">
			<div className="flex items-center gap-2 text-muted-foreground">
				<SpinnerIcon className="h-5 w-5 animate-spin" />
				<span>Loading editor...</span>
			</div>
		</div>
	);
}
