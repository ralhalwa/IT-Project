// export interface User {
//   id: string;
//   name: string;
//   email: string;
//   posts: Post[];
//   followers: User[];
//   following: User[];
//   isPublic: boolean;
// }

export interface User {
    id: string;
    name: string;
    firstName: string;
    lastName: string;
    nickname?: string;
    avatar?: string;
    online?: boolean;
    isPublic?: boolean;
}


export interface Post{
    
}

export interface UserForInvite{
  id: string;
  firstName: string;
  lastName: string;
  nickname: string;
  avatar: string;
}

export type Relationship = {
    iFollow: boolean
    followsMe: boolean
}

export type Msg = {
  id: string
  from: string
  to?: string
  groupId?: string
  text: string
  ts: string
  seen?: boolean
  firstName?: string;
  lastName?: string;
  nickname?: string;
  avatar?: string;
}

export type Group = {
  id: number | string;
    name: string;
    title: string;
    description: string;
    creator_id: string;
    createdAt: string;
    avatar?: string;
    member_count: number;
    is_member: boolean;
    unread?: number;
}

export interface GroupFormType{
  title: string;
  description: string;
  members: string[];
}

export interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  nickname: string;
  email: string;
  dob: string;
  aboutMe: string;
  avatar: string;
  postCount?: number;
  online?: boolean
  isPublic?: boolean
}