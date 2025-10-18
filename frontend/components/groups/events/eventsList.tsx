import { useState, useEffect } from 'react';
import CreateEventModal from './createEventModal';
import { Plus, Calendar } from 'lucide-react';
import EventCard from './eventCard';
import { toast, ToastContainer } from 'react-toastify';

interface Event {
  id: number;
  title: string;
  description: string;
  datetime: string;
  created_by: string;
  creator_name?: string;
  going_count: number;
  not_going_count: number;
  might_be_late_count: number;
  user_response?: string;
}

interface EventsListProps {
  groupId: string;
  isGroupMember: boolean;
  refreshKey?: number;
}

export default function EventsList({ groupId, isGroupMember ,  refreshKey = 0,}: EventsListProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    fetchEvents();
  }, [groupId, refreshKey]);

  const fetchEvents = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/group/events?group_id=${groupId}&timezone=${encodeURIComponent(userTimezone)}`);
      const data = await response.json();
      
      if (data.ok) {
        setEvents(data.events || []);
      }
    } catch (error) {
      console.error('Failed to fetch events:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const handleCreateEvent = async (eventData: { title: string; description: string; datetime: string }) => {
    try {
      const formData = new URLSearchParams();
      formData.append('group_id', groupId);
      formData.append('event_title', eventData.title);
      formData.append('event_description', eventData.description);
      formData.append('event_day_and_time', eventData.datetime);
      formData.append("timezone", userTimezone);

      const response = await fetch('/api/group/create-event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
        credentials: 'include'
      });

      const responseText = await response.text();

      if (!response.ok) {
       console.error('Server error response:', responseText);
      // throw new Error(`Server returned ${response.status}: ${errorText}`);
        }

      const data = JSON.parse(responseText);
      
      if (data.ok) {
        setShowCreateModal(false);
        fetchEvents(); // Refresh the events list
      } else {
        toast.error('Failed to create event: ' + data.error);
      }
    } catch (error) {
      console.error('Error creating event:', error);
      toast.error('Error creating event');
    }
  };

  const handleVote = async (eventId: number, response: string) => {
    try {
      const formData = new URLSearchParams();
      formData.append('group_id', groupId);
      formData.append('event_id', eventId.toString());
      formData.append('response', response);
      
      const voteResponse = await fetch('/api/group/event-vote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
        credentials: 'include'
      });

      const data = await voteResponse.json();
      
      if (!data.ok) {
        toast.error('Failed to vote: ' + data.error);
        // Refresh to get current state
        fetchEvents();
      } else {
       setEvents(prev => prev.map(event => {
        if (event.id !== eventId) return event;
        
        const prevResponse = event.user_response;
        let goingCount = event.going_count || 0;
        let notGoingCount = event.not_going_count || 0;
        let mightBeLateCount = event.might_be_late_count || 0;
        
        // Decrement count for prev response
        if (prevResponse === "I'll be there") {
          goingCount = Math.max(0, (goingCount || 1) - 1);
        } else if (prevResponse === "Can't make it") {
          notGoingCount = Math.max(0, (notGoingCount || 1) - 1);
        } else if (prevResponse === "Might be late") {
          mightBeLateCount = Math.max(0, (mightBeLateCount || 1) - 1);
        }
        
        // Increment count for new response
        if (response === "I'll be there") {
          goingCount = (goingCount || 0) + 1;
        } else if (response === "Can't make it") {
          notGoingCount = (notGoingCount || 0) + 1;
        } else if (response === "Might be late") {
          mightBeLateCount = (mightBeLateCount || 0) + 1;
        }
        
        return {
          ...event,
          user_response: response,
          going_count: goingCount,
          not_going_count: notGoingCount,
          might_be_late_count: mightBeLateCount
        };
      }));
    }
    } catch (error) {
      console.error('Error voting:', error);
      toast.error('Error submitting vote');
      fetchEvents(); // Refresh to get current state
    }
  };

  return (
    <div className="p-2">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-white flex items-center">
          <Calendar className="w-5 h-5 mr-2" />
          Group Events
        </h2>
        
        {isGroupMember && (
          <button
            onClick={() => setShowCreateModal(true)}
            title='create event'
            className="flex items-center gap-2 px-2 py-1 text-base text-white rounded-lg border bg-[#1b1b1b] border-[rgba(255,0,255,.35)]"
          >
            <Plus className="w-5 h-5" />
          </button>
        )}
      </div>

      {events.length === 0 ? (
        <div className="text-center py-12 text-[#aab9c2]">
          <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-lg">No events yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {events.map(event => (
            <EventCard
              key={event.id}
              event={event}
              onVote={handleVote}
            />
          ))}
        </div>
      )}

      <CreateEventModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateEvent}
        groupId={groupId}
      />
       {/* <ToastContainer
        position="bottom-left"
        autoClose={4000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
      /> */}
    </div>
  );
}