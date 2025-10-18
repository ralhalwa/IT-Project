import { useState } from 'react';
import { X, Calendar, Clock } from 'lucide-react';

interface CreateEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (event: { title: string; description: string; datetime: string }) => void;
  groupId: string;
}

export default function CreateEventModal({ isOpen, onClose, onSubmit, groupId }: CreateEventModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const datetime = `${date}T${time}`;
    onSubmit({ title, description, datetime });
    setTitle('');
    setDescription('');
    setDate('');
    setTime('');
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-[#1a1a1a] rounded-xl border bg-[#1b1b1b] border-[rgba(255,0,255,.35)] p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-white">Create New Event</h2>
          <button onClick={onClose} className="text-[#aab9c2] hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-[#2a2a2a] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2 text-white"
              required
              maxLength={20}
              placeholder='Enter event title'
            />
          </div>

          <div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-[#2a2a2a] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2 text-white resize-none"
              rows={3}
              maxLength={100}
              placeholder='Enter event description'
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#aab9c2] mb-1">
                <Calendar className="w-4 h-4 inline mr-1" />
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                min={today}
                className="w-full bg-[#2a2a2a] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2 text-white"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#aab9c2] mb-1">
                <Clock className="w-4 h-4 inline mr-1" />
                Time
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full bg-[#2a2a2a] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2 text-white"
                required
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              className="flex-1 px-4 py-2 text-white rounded-lg bg-[rgba(255,0,255,.35)] text-white py-2 rounded-md transition hover:bg-[rgba(255,0,255,.50)]"
            >
              Create Event
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}