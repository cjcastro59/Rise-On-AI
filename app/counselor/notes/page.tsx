"use client";

import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";

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
    } catch (error) {
      console.error("Error adding note:", error);
    } finally {
      setLoading(false);
    }
  };

  // Delete a note
  const handleDeleteNote = async (id: string) => {
    if (!confirm("Are you sure you want to delete this note?")) return;

    try {
      const { error } = await supabase
        .from("notes")
        .delete()
        .eq("id", id);

      if (error) throw error;
      
      setNotes(notes.filter(note => note.id !== id));
    } catch (error) {
      console.error("Error deleting note:", error);
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
    } catch (error) {
      console.error("Error updating note:", error);
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
      {/* Header */}
      <div className="flex justify-between items-center pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-dm-serif text-dark-text">Notes</h1>
          <p className="text-sm text-dark-text/60 font-poppins">Write and manage your notes.</p>
        </div>
      </div>

      {/* Add Note Form */}
      <Card className="p-6">
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
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-poppins font-semibold text-dark-text">Your Notes</h3>
          <span className="text-sm text-dark-text/60 font-poppins">{notes.length} notes</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-blue"></div>
          </div>
        ) : notes.length === 0 ? (
          <div className="text-center py-12 text-dark-text/60">
            <p>No notes yet. Create your first note above!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => (
              <div key={note.id} className="border border-gray-200 rounded-xl p-4">
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
                    <p className="text-dark-text mb-3 font-inter whitespace-pre-wrap">{note.content}</p>
                    <div className="flex items-center justify-between text-xs text-dark-text/60">
                      <span>Updated: {formatDate(note.updated_at)}</span>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => startEditing(note)}
                          className="text-primary-blue hover:underline"
                        >
                          Edit
                        </button>
                        <button 
                          onClick={() => handleDeleteNote(note.id)}
                          className="text-[#F4A6A6] hover:underline"
                        >
                          Delete
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
