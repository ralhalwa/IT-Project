import React, { useState, useEffect} from "react";
import { SquareCheck, SquareX } from "lucide-react";

interface FollowRequest{
  id: string;
  firstName: string;
  lastName: string;
  avatar: string;
  createdAt: string;
}
interface FollowRequestsProps {
  onRequestHandled?: () => void;
  onAccessChange?: (status?: "accepted" | "declined") => void;
}

export default function FollowRequests({
    onRequestHandled,
    onAccessChange,
    }: FollowRequestsProps){
    const [requests, setRequests] = useState<FollowRequest[]>([]);
    const [loading, setLoading] = useState(true)

    useEffect( () => {
        fetchPendingRequests();
    }, []);

    const fetchPendingRequests = async () => {
        try{
            const res = await fetch("/api/users/pending-requests",{
                credentials: "include",
            })

        if (res.ok){
            const data = await res.json();
            setRequests(data.requests || []);
        }
        }catch (error){
            console.error("Error fetching pending requests:", error);
        }finally{
           setLoading(false); 
        }
    };

    const handleRespond = async(followerId: string, action: "accept" | "decline") => {
        try{
            const res = await fetch("/api/users/respond-follow-request", {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ follower_id: followerId, action }),
            });

            if (res.ok){
                //remove request from list after response
                setRequests( prev => prev.filter(req => req.id !== followerId))

                //refersh counts
               if (onRequestHandled) {
                  // little delay to ensure backend processes the request
                  setTimeout(() => {
                    onRequestHandled();
                  }, 100);
                }

               if (action === "accept") {
                    onAccessChange?.("accepted");
                }

            }
        }catch(error){
            console.error("Error responding to request:", error);
        }
    };


    if (loading) return <div>Loading...</div>

    return(
        <div className="p-6">
            {requests.length === 0 ? (
                <p className="text-white/60">No pending requests</p>
            ) : (
                <div className="space-y-3">
                    {requests.map( (request) => (
                    <div key={request.id} className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                        <div className="flex items-center gap-3">
                                <img
                                src={request.avatar
                                    ? (request.avatar.startsWith('/')
                                    ? request.avatar
                                    : `/avatars/${request.avatar}`)
                                    : "/avatars/avatar.jpeg"}
                                alt={`${request.firstName} ${request.lastName}`}
                                className="w-10 h-10 rounded-full"
                                onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.src = "/avatars/avatar.jpeg";
                                }}
                                />
                        <div>
                            <p className="text-white font-medium">
                                {request.firstName} {request.lastName}</p>
                            <p className="text-white/60 text-sm">
                                {new Date(request.createdAt).toLocaleDateString()}
                            </p>
                        </div>
                        </div>

                        <div className="flex gap-1">
                        <button
                        onClick={ () => handleRespond(request.id, "accept")}
                        className="px-1 py-1 text-green-300 rounded hover:text-green-400"
                        >
                        <SquareCheck/>
                        </button>

                        <button
                        onClick={() => handleRespond(request.id, "decline")}
                        className="px-1 py-1 text-red-300 rounded hover:text-red-400"
                        >
                        <SquareX/>
                        </button>
                        </div>

                        </div>
                    ))}
                    </div>
            )}
        </div>
    )
}