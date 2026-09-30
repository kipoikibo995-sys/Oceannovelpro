import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useEditor, EditorContent, ReactRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Mention from '@tiptap/extension-mention';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import tippy from 'tippy.js';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, 
  Heading1, Heading2, List, ListOrdered, 
  Scissors, CheckCircle2, UserCheck
} from 'lucide-react';
import { autoLinkEntitiesInHtml, autoLinkEntitiesInPlainText } from '@/lib/entityAutoLinker';

// Suggestion list component
const MentionList = forwardRef((props: any, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index: number) => {
    const item = props.items[index];
    if (item) {
      props.command({ id: item.id, label: item.name });
    }
  };

  const upHandler = () => {
    setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
  };

  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % props.items.length);
  };

  const enterHandler = () => {
    selectItem(selectedIndex);
  };

  useEffect(() => setSelectedIndex(0), [props.items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: any) => {
      if (event.key === 'ArrowUp') {
        upHandler();
        return true;
      }
      if (event.key === 'ArrowDown') {
        downHandler();
        return true;
      }
      if (event.key === 'Enter') {
        enterHandler();
        return true;
      }
      return false;
    },
  }));

  return (
    <div className="bg-white shadow-[0_12px_32px_-12px_rgba(14,29,38,0.3)] border border-[#E9E2D4] rounded-2xl overflow-hidden p-1.5 min-w-[240px] z-50 font-['Outfit']">
      <div className="px-2.5 pt-1.5 pb-2 text-[11px] font-semibold text-[#0E1D26]/40 uppercase tracking-[0.14em] flex items-center justify-between">
        <span>Mention</span>
        <span className="normal-case tracking-normal">↵ to insert</span>
      </div>
      {props.items.length ? (
        <div className="max-h-48 overflow-y-auto">
          {props.items.map((item: any, index: number) => (
            <button
              className={`w-full px-2.5 py-2 rounded-xl text-left flex items-center gap-3 transition-colors cursor-pointer ${
                index === selectedIndex ? 'bg-[#F3EEE4]' : 'hover:bg-[#F3EEE4]/60'
              }`}
              key={`mention-item-${item.id || item.name || index}-${index}`}
              onClick={() => selectItem(index)}
            >
              <div className="w-7 h-7 rounded-full bg-[#EFE9DE] flex items-center justify-center text-[12px] text-[#0E1D26]/70 font-bold">
                {item.name.charAt(0)}
              </div>
              <div>
                <div className="text-[14px] font-semibold text-[#0E1D26]">{item.name}</div>
                <div className="text-[12px] text-[#0E1D26]/50">{item.role || item.type || 'Character'}</div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="px-2.5 py-2 text-[13px] text-[#0E1D26]/50">No match</div>
      )}
    </div>
  );
});
MentionList.displayName = 'MentionList';

// Suggestion configuration
let currentMentionItems: any[] = [];

const suggestion = {
  items: ({ query }: { query: string }) => {
    return currentMentionItems.filter(item => item.name.toLowerCase().includes(query.toLowerCase())).slice(0, 5);
  },

  render: () => {
    let component: ReactRenderer;
    let popup: any;

    return {
      onStart: (props: any) => {
        component = new ReactRenderer(MentionList, {
          props,
          editor: props.editor,
        });

        if (!props.clientRect) {
          return;
        }

        popup = tippy('body', {
          getReferenceClientRect: props.clientRect,
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'bottom-start',
        });
      },

      onUpdate(props: any) {
        component.updateProps(props);

        if (!props.clientRect) {
          return;
        }

        popup[0].setProps({
          getReferenceClientRect: props.clientRect,
        });
      },

      onKeyDown(props: any) {
        if (props.event.key === 'Escape') {
          popup[0].hide();
          return true;
        }
        return (component.ref as any)?.onKeyDown(props);
      },

      onExit() {
        if (popup && popup[0]) popup[0].destroy();
        if (component) component.destroy();
      },
    };
  },
};

// Menu Button Component
function MenuButton({ children, action, isActive }: any) {
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        action();
      }}
      className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
        isActive ? 'bg-[#EFE9DE] text-[#0E1D26]' : 'text-[#0E1D26]/55 hover:text-[#0E1D26] hover:bg-[#F3EEE4]'
      }`}
      type="button"
    >
      {children}
    </button>
  );
}

// Main component
interface MentionEditorProps {
  initialValue: string;
  onEntityClick: (entityId: string, entityType: 'character' | 'location') => void;
  onChange?: (value: string) => void;
  className?: string;
  mentionItems?: any[];
  highlightText?: string;
}

export default function MentionEditor({ 
  initialValue, 
  onEntityClick, 
  onChange, 
  className = '', 
  mentionItems = [],
  highlightText 
}: MentionEditorProps) {
  useEffect(() => {
    currentMentionItems = mentionItems;
  }, [mentionItems]);
  currentMentionItems = mentionItems;

  const editorRef = useRef<any>(null);
  const [toastInfo, setToastInfo] = useState<{
    visible: boolean;
    count: number;
    names: string[];
    message?: string;
  } | null>(null);

  const toastTimerRef = useRef<any>(null);

  const showToast = (count: number, names: string[], customMessage?: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastInfo({
      visible: true,
      count,
      names,
      message: customMessage,
    });
    toastTimerRef.current = setTimeout(() => {
      setToastInfo(null);
    }, 3800);
  };

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Highlight.configure({ multicolor: false }),
      TextAlign.configure({ types: ['heading', 'paragraph'], defaultAlignment: 'justify' }),
      Mention.configure({
        HTMLAttributes: {
          class: 'mention-node font-semibold text-[#0E1D26] hover:bg-[#E8561F]/10 px-0.5 rounded cursor-pointer transition-colors duration-150 decoration-none inline-block border-b border-[#E8561F]/35 hover:border-[#E8561F]',
        },
        // IMPORTANT: Eliminates '@' in text, displays character name cleanly in bold
        renderLabel({ node }) {
          return `${node.attrs.label ?? node.attrs.id}`;
        },
        suggestion,
      }),
    ],
    content: initialValue,
    editorProps: {
      attributes: {
        class: `prose prose-stone prose-lg max-w-none w-full h-full px-4 outline-none focus:outline-none overflow-y-auto pb-32`,
        style: 'min-height: 100%;',
      },
      handleClick(view, pos, event) {
        const target = event.target as HTMLElement;
        const mentionEl = target.closest('[data-type="mention"], .mention, .mention-node');
        if (mentionEl) {
          const id = mentionEl.getAttribute('data-id');
          if (id) {
            onEntityClick(id, 'character');
            return true;
          }
        }
        return false;
      },
      // AUTOMATIC RECOGNITION ON PASTE
      handlePaste(view, event) {
        if (!currentMentionItems || currentMentionItems.length === 0) return false;

        const clipboard = event.clipboardData;
        if (!clipboard) return false;

        const html = clipboard.getData('text/html');
        const text = clipboard.getData('text/plain');

        if (!text && !html) return false;

        let res: { html: string; linkedCount: number; linkedNames: string[] } | null = null;
        if (html) {
          res = autoLinkEntitiesInHtml(html, currentMentionItems);
        } else if (text) {
          res = autoLinkEntitiesInPlainText(text, currentMentionItems);
        }

        if (res && res.linkedCount > 0 && res.html) {
          event.preventDefault();
          if (editorRef.current && !editorRef.current.isDestroyed) {
            editorRef.current.commands.insertContent(res.html);
            showToast(res.linkedCount, res.linkedNames);
            return true;
          }
        }

        return false;
      },
    },
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
  });

  editorRef.current = editor;

  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setPortalTarget(document.getElementById('editor-toolbar-portal-target'));
  }, []);

  // Sync when active scene changes (initialValue changes)
  useEffect(() => {
    if (editor && !editor.isDestroyed && initialValue !== editor.getHTML()) {
      editor.commands.setContent(initialValue);
    }
  }, [initialValue, editor]);

  // Highlight and scroll to search query when requested
  useEffect(() => {
    if (!editor || editor.isDestroyed || !highlightText || !highlightText.trim()) return;

    const timer = setTimeout(() => {
      try {
        const term = highlightText.trim().toLowerCase();
        const doc = editor.state.doc;
        let foundPos = -1;

        doc.descendants((node, pos) => {
          if (foundPos !== -1) return false;
          if (node.isText && node.text) {
            const idx = node.text.toLowerCase().indexOf(term);
            if (idx !== -1) {
              foundPos = pos + idx;
              return false;
            }
          }
          return true;
        });

        if (foundPos !== -1) {
          editor.commands.focus();
          editor.commands.setTextSelection({
            from: foundPos,
            to: foundPos + term.length,
          });
          editor.commands.scrollIntoView();
        }
      } catch (err) {
        console.warn("Could not scroll to search keyword:", err);
      }
    }, 120);

    return () => clearTimeout(timer);
  }, [editor, highlightText, initialValue]);

  // 1-Click Scan & Auto-Link Entire Scene
  const handleScanAndAutoLinkCurrentContent = () => {
    if (!editor || editor.isDestroyed || !mentionItems || mentionItems.length === 0) return;
    const currentHtml = editor.getHTML();
    const res = autoLinkEntitiesInHtml(currentHtml, mentionItems);
    if (res.linkedCount > 0) {
      editor.commands.setContent(res.html);
      showToast(res.linkedCount, res.linkedNames, `Scanned and bolded ${res.linkedCount} character reference${res.linkedCount > 1 ? 's' : ''}!`);
    } else {
      showToast(0, [], `All characters in this scene are already linked.`);
    }
  };

  return (
    <div className={`flex flex-col h-full w-full bg-transparent overflow-hidden custom-editor-container relative ${className}`}>
      
      {/* Toast notification when characters are auto-recognized */}
      <AnimatePresence>
        {toastInfo && (
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute top-2 right-4 z-50 bg-[#0E1D26] text-[#F6F1E7] text-xs px-3.5 py-2.5 rounded-2xl shadow-xl flex items-center gap-2.5 max-w-md pointer-events-auto"
          >
            <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              {toastInfo.message ? (
                <div className="font-medium text-stone-200">{toastInfo.message}</div>
              ) : (
                <div>
                  <span className="font-semibold text-white">Auto-detected & bolded ({toastInfo.count}): </span>
                  <span className="text-[#F0B54B] font-medium">
                    {toastInfo.names.slice(0, 4).join(', ')}{toastInfo.names.length > 4 ? ` +${toastInfo.names.length - 4}` : ''}
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={() => setToastInfo(null)}
              className="text-stone-400 hover:text-white text-xs px-1"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative flex-grow overflow-y-auto">
        <EditorContent editor={editor} className="h-full" />
        
        {editor?.isEmpty && (
          <div className="absolute top-0 left-4 right-4 pointer-events-none text-[#0E1D26]/30 font-serif text-lg">
            Start writing, or paste a draft. Type @ to mention a character or place.
          </div>
        )}

        {/* Static Header Toolbar via Portal */}
        {editor && portalTarget && createPortal(
          <div className="flex items-center gap-0.5">
            <MenuButton action={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')}><Bold className="w-4 h-4" /></MenuButton>
            <MenuButton action={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')}><Italic className="w-4 h-4" /></MenuButton>
            <MenuButton action={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive('strike')}><Strikethrough className="w-4 h-4" /></MenuButton>
            
            <div className="w-px h-4 bg-[#0E1D26]/10 mx-1" />
            
            <MenuButton action={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} isActive={editor.isActive('heading', { level: 1 })}><Heading1 className="w-4 h-4" /></MenuButton>
            <MenuButton action={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive('heading', { level: 2 })}><Heading2 className="w-4 h-4" /></MenuButton>
            
            <div className="w-px h-4 bg-[#0E1D26]/10 mx-1" />
            
            <MenuButton action={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive('bulletList')}><List className="w-4 h-4" /></MenuButton>
            <MenuButton action={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive('orderedList')}><ListOrdered className="w-4 h-4" /></MenuButton>
            
            <div className="w-px h-4 bg-[#0E1D26]/10 mx-1" />

            <button
              onClick={(e) => { e.preventDefault(); editor.chain().focus().setHorizontalRule().run(); }}
              className="w-8 h-8 rounded-full text-[#0E1D26]/55 hover:text-[#0E1D26] hover:bg-[#F3EEE4] transition-colors flex items-center justify-center cursor-pointer"
              title="Scene Break"
            >
              <Scissors className="w-4 h-4" />
            </button>

            <div className="w-px h-4 bg-[#0E1D26]/10 mx-1" />

            {/* Smart Auto-Link Entity Button & Indicator */}
            <button
              onClick={(e) => {
                e.preventDefault();
                handleScanAndAutoLinkCurrentContent();
              }}
              className="h-8 px-3 rounded-full text-[12px] font-semibold text-[#0E1D26]/70 hover:text-[#0E1D26] hover:bg-[#F3EEE4] transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Auto-detect & bold all character mentions in this scene"
              type="button"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Auto-link</span>
            </button>
          </div>,
          portalTarget
        )}
      </div>
    </div>
  );
}
