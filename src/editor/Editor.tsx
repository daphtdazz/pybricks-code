// SPDX-License-Identifier: MIT
// Copyright (c) 2020-2023 The Pybricks Authors

import './editor.scss';
import {
    Button,
    Classes,
    ContextMenu,
    Menu,
    MenuDivider,
    MenuItem,
    OverlayLifecycleProps,
    ResizeSensor,
    Tab,
    TabId,
    Tabs,
    Text,
} from '@blueprintjs/core';
import {
    Blank,
    Clipboard,
    Cross,
    Duplicate,
    Manual,
    Redo,
    Undo,
} from '@blueprintjs/icons';
import classNames from 'classnames';
import * as monaco from 'monaco-editor';
import tomorrowNightEightiesTheme from 'monaco-themes/themes/Tomorrow-Night-Eighties.json';
import xcodeTheme from 'monaco-themes/themes/Xcode_default.json';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useId } from 'react-aria';
import { useDispatch } from 'react-redux';
import { useEffectOnce, useTernaryDarkMode } from 'usehooks-ts';
import { UUID } from '../fileStorage';
import { useFileStoragePath } from '../fileStorage/hooks';
import { compile } from '../mpy/actions';
import { useSelector } from '../reducers';
import { useSettingIsShowDocsEnabled } from '../settings/hooks';
import { isMacOS } from '../utils/os';
import Welcome from './Welcome';
import { editorActivateFile, editorCloseFile } from './actions';
import { useI18n } from './i18n';
import * as pybricksMicroPython from './pybricksMicroPython';
import { pybricksMicroPythonId } from './pybricksMicroPython';
import { UntitledHintContribution } from './untitledHint';

monaco.languages.register({ id: pybricksMicroPythonId });

const toDispose = new Array<monaco.IDisposable>();
toDispose.push(
    monaco.languages.setLanguageConfiguration(
        pybricksMicroPythonId,
        pybricksMicroPython.conf,
    ),
    monaco.languages.setMonarchTokensProvider(
        pybricksMicroPythonId,
        pybricksMicroPython.language,
    ),
    monaco.languages.registerCompletionItemProvider(
        pybricksMicroPythonId,
        pybricksMicroPython.templateSnippetCompletions,
    ),
);

// https://webpack.js.org/api/hot-module-replacement/
// istanbul ignore if: only used for development
if (module.hot) {
    module.hot.dispose(() => {
        toDispose.forEach((s) => s.dispose());
    });
}

const tomorrowNightEightiesId = 'tomorrow-night-eighties';
monaco.editor.defineTheme(
    tomorrowNightEightiesId,
    tomorrowNightEightiesTheme as monaco.editor.IStandaloneThemeData,
);

const xcodeId = 'xcode';
monaco.editor.defineTheme(xcodeId, xcodeTheme as monaco.editor.IStandaloneThemeData);

type EditorContextMenuItemProps = Readonly<{
    /** The menu item label. */
    label: string;
    /** The menu item icon. */
    icon: JSX.Element;
    /** The keyboard shortcut that triggers the same action. */
    keyboardShortcut: string;
    /** Controls the menu item disabled state. */
    disabled: boolean;
    /** A reference to the editor. */
    editor: monaco.editor.IStandaloneCodeEditor | undefined;
    /** The action handler ID passed to the editor.trigger() method. */
    editorAction: string;
}>;

const EditorContextMenuItem: React.FunctionComponent<EditorContextMenuItemProps> = ({
    label,
    icon,
    keyboardShortcut,
    disabled,
    editor,
    editorAction,
}) => {
    const labelId = useId();

    return (
        <MenuItem
            role="menuitem"
            aria-labelledby={labelId}
            text={<span id={labelId}>{label}</span>}
            icon={icon}
            label={keyboardShortcut}
            disabled={disabled}
            onClick={() => {
                // have to focus first or the trigger won't work
                editor?.focus();
                editor?.trigger(null, editorAction, null);
            }}
        />
    );
};

type EditorContextMenuProps = {
    /** The editor. */
    editor: monaco.editor.IStandaloneCodeEditor | undefined;
};

const EditorContextMenu: React.FunctionComponent<EditorContextMenuProps> = ({
    editor,
}) => {
    const i18n = useI18n();
    const selection = editor?.getSelection();
    const hasSelection = selection && !selection.isEmpty();

    const model = editor?.getModel();
    const canUndo = model && model.canUndo();
    const canRedo = model && model.canRedo();

    return (
        <Menu aria-label={i18n.translate('contextMenu.label')} role="menu">
            <EditorContextMenuItem
                label={i18n.translate('copy')}
                icon={<Duplicate />}
                keyboardShortcut={isMacOS() ? 'Cmd-C' : 'Ctrl-C'}
                disabled={!hasSelection}
                editor={editor}
                editorAction="editor.action.clipboardCopyAction"
            />
            <EditorContextMenuItem
                label={i18n.translate('paste')}
                icon={<Clipboard />}
                keyboardShortcut={isMacOS() ? 'Cmd-V' : 'Ctrl-V'}
                disabled={!model}
                editor={editor}
                editorAction="editor.action.clipboardPasteAction"
            />
            <EditorContextMenuItem
                label={i18n.translate('selectAll')}
                icon={<Blank />}
                keyboardShortcut={isMacOS() ? 'Cmd-A' : 'Ctrl-A'}
                disabled={!model}
                editor={editor}
                editorAction="editor.action.selectAll"
            />
            <MenuDivider />
            <EditorContextMenuItem
                label={i18n.translate('undo')}
                icon={<Undo />}
                keyboardShortcut={isMacOS() ? 'Cmd-Z' : 'Ctrl-Z'}
                disabled={!canUndo}
                editor={editor}
                editorAction="undo"
            />
            <EditorContextMenuItem
                label={i18n.translate('redo')}
                icon={<Redo />}
                keyboardShortcut={isMacOS() ? 'Cmd-Shift-Z' : 'Ctrl-Shift-Z'}
                disabled={!canRedo}
                editor={editor}
                editorAction="redo"
            />
        </Menu>
    );
};

type FileNameProps = {
    /** The DOM ID. */
    id: string;
    /** The file UUID. */
    uuid: UUID;
    /** Called when the file name changes. */
    onNameChanged: () => void;
};

const TabLabel: React.FunctionComponent<FileNameProps> = ({
    id,
    uuid,
    onNameChanged,
}) => {
    const fileName = useFileStoragePath(uuid);

    useEffect(() => {
        onNameChanged?.();
    }, [fileName, onNameChanged]);

    return (
        <Text tagName="span" id={id} ellipsize={true}>
            {fileName}
        </Text>
    );
};

type TabCloseButtonProps = {
    /** The file UUID. */
    uuid: UUID;
};

const TabCloseButton: React.FunctionComponent<TabCloseButtonProps> = ({ uuid }) => {
    const fileName = useFileStoragePath(uuid) ?? '';
    const dispatch = useDispatch();
    const i18n = useI18n();

    return (
        <Button
            title={i18n.translate('closeFile.tooltip', {
                fileName,
            })}
            minimal={true}
            small={true}
            icon={<Cross />}
            // tabs are closed with delete button by keyboard, so
            // don't focus the close button
            tabIndex={-1}
            onFocus={(e) => e.preventDefault()}
            onClick={(e) => {
                dispatch(editorCloseFile(uuid));
                // prevent triggering Tabs onChange
                e.stopPropagation();
            }}
        />
    );
};

type EditorTabsProps = Readonly<{
    /** Called when the selected tab changes. */
    onChange?: () => void;
}>;

const EditorTabs: React.FunctionComponent<EditorTabsProps> = ({ onChange }) => {
    const openFiles = useSelector((s) => s.editor.openFileUuids);
    const activeFile = useSelector((s) => s.editor.activeFileUuid);
    const dispatch = useDispatch();

    const handleChange = useCallback(
        (newTabId: TabId) => {
            dispatch(editorActivateFile(newTabId as UUID));
            onChange?.();
        },
        [dispatch, onChange],
    );

    const labelId = useId();

    // close tab when delete key is pressed
    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent, uuid: UUID) => {
            if (e.key === 'Delete') {
                dispatch(editorCloseFile(uuid));
                e.preventDefault();
                e.stopPropagation();
            }
        },
        [dispatch],
    );

    // close tab when middle-clicked
    // NB: this has to be on mouse up event to prevent middle-click paste on Linux
    const handleMouseUp = useCallback(
        (e: React.MouseEvent, uuid: UUID) => {
            if (e.button === 1) {
                dispatch(editorCloseFile(uuid));
                e.preventDefault();
                e.stopPropagation();
            }
        },
        [dispatch],
    );

    const tabsRef = useRef<Tabs>(null);

    // HACK: call private Tabs method to fix selection indicator animation when
    // a file is renamed
    const handleNameChanged = useCallback(() => {
        tabsRef.current?.['moveSelectionIndicator']();
    }, [tabsRef]);

    const i18n = useI18n();

    useEffect(() => {
        // @ts-expect-error: using private property
        const tablist: HTMLDivElement = tabsRef.current?.tablistElement;

        // istanbul-ignore-if: should not happen
        if (!tablist) {
            return;
        }

        tablist.setAttribute('aria-label', i18n.translate('tablist.label'));
    }, [i18n]);

    return (
        <Tabs
            className="pb-editor-tablist"
            selectedTabId={activeFile || undefined}
            ref={tabsRef}
            onChange={handleChange}
        >
            {openFiles.map((uuid) => (
                <Tab
                    className="pb-editor-tablist-tab"
                    aria-labelledby={`${labelId}.${uuid}`}
                    key={uuid}
                    id={uuid}
                    onKeyDown={(e) => handleKeyDown(e, uuid)}
                    onMouseUp={(e) => handleMouseUp(e, uuid)}
                >
                    <TabLabel
                        id={`${labelId}.${uuid}`}
                        uuid={uuid}
                        onNameChanged={handleNameChanged}
                    />
                    <TabCloseButton uuid={uuid} />
                </Tab>
            ))}
        </Tabs>
    );
};

/**
 * Wrapper around useEffect() hook that uses {@link maybeEditor}.
 * @param maybeEditor The editor or undefined if the editor is not mounted.
 * @param callback The callback to call when editor is defined and when {@link deps} change.
 * @param deps Additional dependencies used in the {@link callback}.
 */
function useEditor(
    maybeEditor: monaco.editor.IStandaloneCodeEditor | undefined,
    callback: (
        editor: monaco.editor.IStandaloneCodeEditor,
    ) => ReturnType<React.EffectCallback>,
    deps: React.DependencyList,
): void {
    useEffect(() => {
        if (!maybeEditor) {
            return;
        }

        return callback(maybeEditor);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [maybeEditor, callback, ...deps]);
}

/**
 * Hook for adding actions to the editor.
 * @param maybeEditor The editor or undefined if the editor is not mounted.
 * @param createAction A callback to create a new action.
 * @param deps Additional dependencies used in {@link createAction}.
 */
function useEditorAction(
    maybeEditor: monaco.editor.IStandaloneCodeEditor | undefined,
    createAction: () => monaco.editor.IActionDescriptor,
    deps: React.DependencyList,
): void {
    useEditor(
        maybeEditor,
        (editor) => {
            const subscription = editor.addAction(createAction());
            return () => subscription.dispose();
        },
        deps,
    );
}

const Editor: React.FunctionComponent = () => {
    const dispatch = useDispatch();

    const [editor, setEditor] = useState<monaco.editor.IStandaloneCodeEditor>();
    const { isSettingShowDocsEnabled, toggleIsSettingShowDocsEnabled } =
        useSettingIsShowDocsEnabled();
    const { isDarkMode } = useTernaryDarkMode();

    const i18n = useI18n();

    useEffect(() => {
        monaco.editor.setTheme(isDarkMode ? tomorrowNightEightiesId : xcodeId);
    }, [isDarkMode]);

    useEditor(
        editor,
        (editor) => {
            const contrib = new UntitledHintContribution(
                editor,
                i18n.translate('placeholder'),
            );
            return () => contrib.dispose();
        },
        [i18n],
    );

    useEditorAction(
        editor,
        () => ({
            id: 'pybricks.action.toggleDocs',
            label: i18n.translate('toggleDocs'),
            run: () => toggleIsSettingShowDocsEnabled(),
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyD],
        }),
        [i18n, toggleIsSettingShowDocsEnabled],
    );

    useEditorAction(
        editor,
        () => ({
            id: 'pybricks.action.check',
            label: i18n.translate('check'),
            run: (e) => {
                // for checking, use the most recent compiler
                dispatch(compile(e.getValue(), 6, []));
            },
            keybindings: [monaco.KeyCode.F2],
        }),
        [i18n, dispatch],
    );

    useEditorAction(
        editor,
        () => ({
            id: 'pybricks.action.save',
            label: 'Unused',
            run: () => {
                // We already automatically save the file after every change,
                // so CTRL+S is ignored
                console.debug('Ctrl-S ignored');
            },
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
        }),
        [],
    );

    const popoverProps = useMemo<OverlayLifecycleProps>(
        () => ({
            onOpened: (e) => {
                // a11y: focus the first item in the menu when the menu opens
                const menuItems = e.getElementsByClassName(Classes.MENU_ITEM);

                const firstItem = menuItems.item(0);

                // istanbul ignore if: should not be reachable
                if (!(firstItem instanceof HTMLElement)) {
                    console.error(`bug: firstItem is not an HTMLElement: ${firstItem}`);
                    return;
                }

                firstItem.focus();
            },
            onClosed: () => editor?.focus(),
        }),
        [editor],
    );

    const editorRef = useRef<HTMLDivElement>(null);

    useEffectOnce(() => {
        // istanbul ignore if: should never happen
        if (!editorRef.current) {
            console.error('no editorRef!');
            return;
        }

        const monacoEditor = monaco.editor.create(editorRef.current, {
            model: null,
            fontSize: 18,
            minimap: { enabled: false },
            contextmenu: false,
            rulers: [80],
            lineNumbersMinChars: 4,
            wordBasedSuggestions: false,
            selectionClipboard: false, // don't copy selection on Linux
        });

        monacoEditor.focus();
        setEditor(monacoEditor);

        return () => {
            setEditor(undefined);
            monacoEditor.dispose();
        };
    });

    const isEmpty = useSelector((s) => s.editor.openFileUuids.length === 0);
    const { activeFileUuid } = useSelector((s) => s.editor);
    const fileName = useFileStoragePath(activeFileUuid ?? ('' as UUID));

    return (
        <div className="pb-editor">
            <EditorTabs onChange={() => editor?.focus()} />
            <ResizeSensor onResize={() => editor?.layout()}>
                <ContextMenu
                    className={classNames('pb-editor-tabpanel', isEmpty && 'pb-empty')}
                    role="tabpanel"
                    aria-label={isEmpty ? i18n.translate('welcome') : fileName}
                    // NB: we have to create a new context menu each time it is
                    // shown in order to get some state, like canUndo and canRedo
                    // that don't have events to monitor changes.
                    content={() => <EditorContextMenu editor={editor} />}
                    popoverProps={popoverProps}
                >
                    <Welcome isVisible={isEmpty} />
                    <div className="pb-editor-monaco" ref={editorRef} />
                </ContextMenu>
            </ResizeSensor>
            <Button
                className="pb-editor-doc-button"
                minimal
                large
                icon={<Manual />}
                title={
                    isSettingShowDocsEnabled
                        ? i18n.translate('docs.hide')
                        : i18n.translate('docs.show')
                }
                onClick={toggleIsSettingShowDocsEnabled}
            />
        </div>
    );
};

export default Editor;
