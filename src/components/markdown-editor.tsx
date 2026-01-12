"use client";

import {
	BlockTypeSelect,
	BoldItalicUnderlineToggles,
	ButtonWithTooltip,
	CreateLink,
	codeBlockPlugin,
	headingsPlugin,
	InsertCodeBlock,
	InsertThematicBreak,
	ListsToggle,
	linkDialogPlugin,
	linkPlugin,
	listsPlugin,
	MDXEditor,
	type MDXEditorMethods,
	markdownShortcutPlugin,
	quotePlugin,
	Separator,
	thematicBreakPlugin,
	toolbarPlugin,
	UndoRedo,
} from "@mdxeditor/editor";
import { SparkleIcon, SpinnerIcon } from "@phosphor-icons/react";
import "@mdxeditor/editor/style.css";
import { useTheme } from "next-themes";
import { forwardRef } from "react";

interface MarkdownEditorProps {
	markdown: string;
	onChange?: (markdown: string) => void;
	placeholder?: string;
	readOnly?: boolean;
	className?: string;
	onAiRefine?: () => void;
	aiLoading?: boolean;
}

function AiRefineButton({
	onClick,
	loading,
}: {
	onClick?: () => void;
	loading?: boolean;
}) {
	if (!onClick) return null;

	return (
		<ButtonWithTooltip
			title="Refine & Improve with AI"
			onClick={onClick}
			disabled={loading}
			className="!inline-flex !flex-row items-center gap-1.5 bg-primary text-white border-none rounded-sm px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-all hover:brightness-90 disabled:opacity-50 disabled:cursor-not-allowed [&>svg]:!inline-block [&>svg]:shrink-0"
		>
			{loading ? (
				<SpinnerIcon className="h-4 w-4 animate-spin" />
			) : (
				<SparkleIcon className="h-4 w-4" weight="fill" />
			)}
		</ButtonWithTooltip>
	);
}

export const MarkdownEditor = forwardRef<MDXEditorMethods, MarkdownEditorProps>(
	(
		{
			markdown,
			onChange,
			placeholder,
			readOnly = false,
			className,
			onAiRefine,
			aiLoading,
		},
		ref,
	) => {
		const { resolvedTheme } = useTheme();
		const isDark = resolvedTheme === "dark";

		return (
			<MDXEditor
				ref={ref}
				markdown={markdown}
				onChange={onChange}
				placeholder={placeholder}
				readOnly={readOnly}
				className={`mdx-editor-wrapper ${isDark ? "dark-theme" : ""} ${className ?? ""}`}
				contentEditableClassName="prose dark:prose-invert max-w-none min-h-[300px] focus:outline-none"
				plugins={[
					headingsPlugin(),
					listsPlugin(),
					quotePlugin(),
					thematicBreakPlugin(),
					codeBlockPlugin({ defaultCodeBlockLanguage: "typescript" }),
					markdownShortcutPlugin(),
					linkPlugin(),
					linkDialogPlugin(),
					toolbarPlugin({
						toolbarContents: () => (
							<>
								<UndoRedo />
								<Separator />
								<BlockTypeSelect />
								<BoldItalicUnderlineToggles />
								<Separator />
								<ListsToggle />
								<CreateLink />
								<InsertCodeBlock />
								<InsertThematicBreak />
								{onAiRefine && (
									<>
										<Separator />
										<AiRefineButton onClick={onAiRefine} loading={aiLoading} />
									</>
								)}
							</>
						),
					}),
				]}
			/>
		);
	},
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
