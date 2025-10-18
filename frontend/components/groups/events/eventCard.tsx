import { useState, useEffect, useRef, useCallback } from 'react';
import { Calendar, Clock, Users, User } from 'lucide-react';

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

interface EventCardProps {
  event: Event;
  onVote: (eventId: number, response: string) => void;
}

export default function EventCard({ event, onVote}: EventCardProps) {
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [selectedResponse, setSelectedResponse] = useState<string>(event.user_response || '');
  const [underlineStyle, setUnderlineStyle] = useState({ width: 0, left: 0, color: 'bg-purple-500' });
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [isPast, setIsPast] = useState<boolean>(false);
  

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const eventDate = new Date(event.datetime);
      const difference = eventDate.getTime() - now.getTime();
      setIsPast(false);

      if (difference <= 0) {
        setTimeLeft('Event passed');
        setIsPast(true);
        return;
      }


      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));

      setTimeLeft(`${days}d ${hours}h ${minutes}m`);
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [event.datetime]);

  useEffect(() => {
    updateUnderlinePosition();

    const handleResize = () => {
      updateUnderlinePosition();
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [selectedResponse]);

const updateUnderlinePosition = useCallback(() => {
    const options = ["I'll be there", "Might be late", "Can't make it"];
    const selectedIndex = options.indexOf(selectedResponse);
    
    if (selectedIndex !== -1 && buttonRefs.current[selectedIndex]) {
      const button = buttonRefs.current[selectedIndex];
      if (button) {
        let colorClass = 'bg-purple-500';
        switch(selectedResponse) {
          case "I'll be there":
            colorClass = 'bg-green-500';
            break;
          case "Might be late":
            colorClass = 'bg-yellow-500';
            break;
          case "Can't make it":
            colorClass = 'bg-red-500';
            break;
        }
        
        setUnderlineStyle({
          width: button.offsetWidth,
          left: button.offsetLeft,
          color: colorClass
        });
      }
    } else if (selectedResponse === '') {
      setUnderlineStyle({ width: 0, left: 0, color: 'bg-purple-500' });
    }
  }, [selectedResponse]);


  const handleVote = (response: string) => {
    if (isPast) return;
    const backendResponseMap = {
    "I'll be there": "I'll be there",
    "Might be late": "Might be late", 
    "Can't make it": "Can't make it"
  };
  
  const backendResponse = backendResponseMap[response as keyof typeof backendResponseMap] || response;
  
  setSelectedResponse(backendResponse);
  onVote(event.id, backendResponse);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const setButtonRef = useCallback((index: number) => (el: HTMLButtonElement | null) => {
    buttonRefs.current[index] = el;
  }, []);

    const getCountForOption = (option: string): number => {
    switch(option) {
      case "I'll be there":
        return event.going_count || 0;
      case "Might be late":
        return event.might_be_late_count || 0;
      case "Can't make it":
        return event.not_going_count || 0;
      default:
        return 0;
    }
  };

  return (
    <div className="rounded-xl border bg-[#1b1b1b] border-[rgba(255,0,255,.35)] p-4 mb-4">
      <div className="flex justify-between items-start mb-3">
        <h3 className="font-semibold text-lg text-white">{event.title}</h3>
        <div className="flex items-center text-sm text-[#aab9c2] bg-[#2a2a2a] border border-[rgba(255,0,255,.35)] px-2 py-1 rounded-full">
          <Clock className="w-4 h-4 mr-1" />
          {timeLeft}
        </div>
      </div>

      <p className="text-[#aab9c2] mb-4 break-words">{event.description}</p>

      <div className="flex items-center justify-between mb-4 text-sm">
        <div className="flex items-center text-[#8899a6]">
          <Calendar className="w-4 h-4 mr-1" />
          {formatDate(event.datetime)} at {formatTime(event.datetime)}
        </div>
        <div className="flex items-center text-[#8899a6]">
          <User className="w-4 h-4 mr-1 text-[rgba(255,0,255,0.7)]" />
          by {event.creator_name || 'Unknown'}
        </div>
      </div>

      {/* Voting Options Container */}
      <div className="mb-4 relative">
        <div className="flex rounded-lg p-1 relative">
          {['I\'ll be there', 'Might be late', 'Can\'t make it'].map((option, index) => (
            <button
              key={option}
              ref={setButtonRef(index)}
              onClick={() => handleVote(option)}
              disabled={isPast}
              className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors relative z-10 ${
                selectedResponse === option 
                  ? 'text-white' 
                  : 'text-[#aab9c2] hover:text-white'
              }`}
            >
              <span className={`text-lg mr-2 ${selectedResponse === option ? 'opacity-100' : 'opacity-70'}`}>
                {getCountForOption(option)}
              </span>
              {option}
            </button>
          ))}
          
          {/* Sliding underline */}
          <div 
            className={`absolute bottom-0 h-0.5 transition-all duration-300 ease-out ${underlineStyle.color}`}
            style={{
              width: `${underlineStyle.width}px`,
              left: `${underlineStyle.left}px`
            }}
          />
        </div>
      </div>
    </div>
  );
}