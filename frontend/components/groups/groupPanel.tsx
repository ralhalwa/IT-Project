import { Clock, Mail, SquareCheck, SquareX, User } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import Avatar from '../ui/avatar';
import { User as UserType} from '@/types/user';
import { toast, ToastContainer } from 'react-toastify';

interface GroupItem {
  group_id: number;
  title: string;
  description: string;
  creator_id: string;
  creator_name: string;
  type: string; // "invite" or "request" or "event"
  user?: UserType;
}

interface GroupPanelProps {
  onInviteAccepted?: () => void;
  onRequestAccepted?: () => void;
}
const GroupPanel: React.FC<GroupPanelProps> = ({onInviteAccepted, onRequestAccepted}) => {
  const [items, setItems] = useState<GroupItem[]>([]);
  const [loading, setLoading] = useState(true);
  

  useEffect(() => {
    fetchUserItems();
  }, []);

  const fetchUserItems = async () => {
    try {
      const res = await fetch('/api/group/panelItems', {
        credentials: 'include'
      });

      if (res.ok) {
        const data = await res.json();

        if (data && Array.isArray(data.items)){
            setItems(data.items);
        }else{
            setItems([])
        }
      }else{
        setItems([]);
      }
    } catch (error) {
      console.error('Failed to fetch invites:', error);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInviteResponse = async (groupID: number, accept: boolean) => {
    try {
      const formData = new URLSearchParams();
      formData.append('group_id', groupID.toString());
      formData.append('response', accept ? 'accept' : 'decline');
      
      const res = await fetch('/api/group/respond-group-invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
        credentials: 'include'
      });

      if (res.ok) {
        // Remove the handled item from the list
        setItems(items.filter(item => !(item.group_id === groupID && item.type === 'invite')));
        toast.success(`Invitation ${accept ? 'accepted' : 'declined'} successfully!`);

        if (accept && onInviteAccepted) {
          onInviteAccepted();
        }
      }
    } catch (error) {
      console.error('Failed to respond to invite:', error);
    }
  };

  const handleRequestResponse = async (groupID: number, userID: string, accept: boolean) => {
    try {
      const formData = new URLSearchParams();
      formData.append('group_id', groupID.toString());
      formData.append('requested_user_id', userID);
      formData.append('response', accept ? 'accept' : 'decline');
      
      const res = await fetch('/api/group/respond-group-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
        credentials: 'include'
      });

      if (res.ok) {
        // Remove the handled request from the list
        setItems(items.filter(item => !(item.group_id === groupID && item.user?.id=== userID && item.type === 'request')));
        toast.success(`Join request ${accept ? 'accepted' : 'declined'} successfully!`);

        if (accept && onRequestAccepted) {
          onRequestAccepted();
        }
      }
    } catch (error) {
      console.error('Failed to respond to join request:', error);
    }
  };

  if (loading) {
    return <div className="text-[#9aa] px-3 py-4 text-center">Loading invites...</div>;
  }

 return (
    <div className="group-panel">
      {items.length === 0 ? (
        <div className="text-[#9aa] px-3 py-4 text-center">
          No pending invites or join requests
        </div>
      ) : (
        items.map(item => (
          <div key={`${item.type}-${item.group_id}-${item.user?.id || ''}`} 
               className="item border border-[rgba(255,0,255,.35)] p-3 rounded-xl mb-3">
            
            {item.type === 'invite' ? (
              // Invite item
              <div>
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center">
                    <Mail className="w-4 h-4 mr-2 text-blue-400" />
                    <h3 className="font-semibold text-white truncate">{item.title}</h3>
                  </div>
                  <span className="bg-blue-500/20 text-blue-300 text-xs px-2 py-1 rounded-lg border border-blue-500/30">
                    Invite
                  </span>
                </div>
                <p className="text-xs text-[#678] mb-3"> you are invited by {item.creator_name} to join group {item.title}</p>
                
                <div className="flex space-x-2">
                  <button
                    title='accept'
                    onClick={() => handleInviteResponse(item.group_id, true)}
                    className="flex items-center text-green-300 hover:text-green-500 px-2 py-1 rounded text-sm"
                  >
                    <SquareCheck className="w-6 h-6 mr-1" />
                  </button>
                  <button
                    title='decline'
                    onClick={() => handleInviteResponse(item.group_id, false)}
                    className="flex items-center text-red-300 hover:text-red-400 px-2 py-1 rounded text-sm "
                  >
                    <SquareX className="w-6 h-6 mr-1" />
                  </button>
                </div>
              </div>
            ) : (
              // Join request item
              <div>
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center">
                    <Clock className="w-4 h-4 mr-2 text-yellow-400" />
                    <h3 className="font-semibold text-white">{item.title}</h3>
                  </div>
                  <span className="bg-yellow-500/20 text-yellow-300 text-xs px-1 py-1 rounded-lg border border-yellow-500/30">
                    Join Request
                  </span>
                </div>
                
                <div className="flex items-center mb-3">
                    {/* <Avatar user={item.user} size={6} color=''/> */}
                  <p className="text-xs text-[#678]">{item.user?.firstName}  {item.user?.lastName} requested to join {item.title}</p>
                </div>
                
                <div className="flex space-x-2">
                  <button
                    title='accept'
                    onClick={() => handleRequestResponse(item.group_id, item.user?.id!, true)}
                    className="flex items-center text-green-300 hover:text-green-500 px-2 py-1 rounded text-sm"
                  >
                    <SquareCheck className="w-6 h-6 mr-1" />
                  </button>
                  <button 
                    title='decline'
                    onClick={() => handleRequestResponse(item.group_id, item.user?.id!, false)}
                    className="flex items-center text-red-300 hover:text-red-400 px-2 py-1 rounded text-sm"
                  >
                    <SquareX className="w-6 h-6 mr-1" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))
      )}
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
};

export default GroupPanel;