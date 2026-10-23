"use client";

import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Toast, useToast } from "@/components/ui/Toast";
import { useConfirmation } from "@/components/layout/ConfirmationModalProvider";

type Note = {
  id: string;
  user_id: string;
  related_user_id?: string;
  content: string;
  created_at: string;
  updated_at: string;
};

export default function CounselorNotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNoteContent, setNewNoteContent] = useState("");
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [editContent, setEditContent] = useState("");
  const [loading, setLoading] = useState(false);
  const { user: currentUser } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const { toast, showToast, closeToast } = useToast();
  const { openConfirmation } = useConfirmation();

  // Load notes
  useEffect(() => {
    if (!currentUser) return;
    const loadNotes = async () => {
      try {
        setLoading(true);
        const { data } = await supabase
          .from("notes")
          .select("*")
          .eq("user_id", currentUser.id)
          .order("updated_at", { ascending: false });
        setNotes(data || []);
      } catch (error) {
        console.error("Error loading notes:", error);
      } finally {
        setLoading(false);
      }
    };
    loadNotes();
  }, [currentUser, supabase]);

  // Add a new note
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteContent.trim() || !currentUser) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("notes")
        .insert({
          user_id: currentUser.id,
          content: newNoteContent.trim()
        })
        .select()
        .single();

      if (error) throw error;

      setNotes([data, ...notes]);
      setNewNoteContent("");
      showToast("Note added.", "success");
    } catch (error) {
      console.error("Error adding note:", error);
      showToast("Failed to add note. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  // Delete a note
  const handleDeleteNote = async (id: string) => {
    const confirmed = await openConfirmation({
      title: "Delete Note",
      message: "Are you sure you want to delete this note?",
      confirmText: "Delete",
      cancelText: "Cancel",
      isDangerous: true,
    });
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("notes")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setNotes(notes.filter(note => note.id !== id));
      showToast("Note deleted.", "success");
    } catch (error) {
      console.error("Error deleting note:", error);
      showToast("Failed to delete note.", "error");
    }
  };

  // Start editing a note
  const startEditing = (note: Note) => {
    setEditingNote(note);
    setEditContent(note.content);
  };

  // Save edited note
  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNote || !editContent.trim()) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("notes")
        .update({
          content: editContent.trim(),
          updated_at: new Date().toISOString()
        })
        .eq("id", editingNote.id)
        .select()
        .single();

      if (error) throw error;

      setNotes(notes.map(note => note.id === editingNote.id ? data : note));
      setEditingNote(null);
      setEditContent("");
      showToast("Note updated.", "success");
    } catch (error) {
      console.error("Error updating note:", error);
      showToast("Failed to update note. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  return (
    <div className="space-y-6">
      <Toast {...toast} onClose={closeToast} />
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white px-6 py-5 shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-dm-serif text-dark-text">Notes</h1>
          <p className="text-sm text-slate-600 font-poppins">Write and manage your notes.</p>
        </div>
      </div>

      {/* Add Note Form */}
      <Card className="p-6 bg-white/80 backdrop-blur-md rounded-2xl border border-white/40 shadow-sm">
        <h3 className="font-poppins font-semibold text-dark-text mb-3">Add a New Note</h3>
        <form onSubmit={handleAddNote} className="space-y-3">
          <textarea
            value={newNoteContent}
            onChange={(e) => setNewNoteContent(e.target.value)}
            placeholder="Write your note here..."
            rows={3}
            className="w-full p-3 border border-gray-300 rounded-xl text-sm font-poppins text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-blue/50 resize-none"
          />
          <Button type="submit" disabled={loading || !newNoteContent.trim()}>
            Add Note
          </Button>
        </form>
      </Card>

      {/* Notes List */}
      <Card className="p-6 bg-white/80 backdrop-blur-md rounded-2xl border border-white/40 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-poppins font-semibold text-dark-text">Your Notes</h3>
          <span className="text-sm text-slate-600 font-poppins">{notes.length} notes</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-blue"></div>
          </div>
        ) : notes.length === 0 ? (
          <div className="text-center py-12 text-slate-600">
            <p>No notes yet. Create your first note above!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => (
              <div key={note.id} className="border border-indigo-100 border-l-4 border-l-indigo-500 bg-indigo-50/30 rounded-xl p-4">
                {editingNote && editingNote.id === note.id ? (
                  <form onSubmit={saveEdit} className="space-y-3">
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={3}
                      className="w-full p-3 border border-gray-300 rounded-xl text-sm font-poppins text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-blue/50 resize-none"
                    />
                    <div className="flex gap-2">
                      <Button type="submit" disabled={loading}>
                        Save
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          setEditingNote(null);
                          setEditContent("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : (
                  <>
                    <blockquote className="text-dark-text mb-3 font-inter leading-relaxed whitespace-pre-wrap">{note.content}</blockquote>
                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span className="rounded-full bg-indigo-50 px-2 py-1 text-indigo-700">Updated: {formatDate(note.updated_at)}</span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => startEditing(note)}
                          title="Edit note"
                          className="rounded-lg bg-slate-100 p-2 text-slate-700 shadow-sm transition-all hover:bg-slate-200"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteNote(note.id)}
                          title="Delete note"
                          className="rounded-lg bg-rose-50 p-2 text-rose-600 shadow-sm transition-all hover:bg-rose-100"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
