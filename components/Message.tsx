
import React from 'react';
import type { Message } from '../types';

interface MessageProps {
  message: Message;
}

const MessageComponent: React.FC<MessageProps> = ({ message }) => {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} my-2`}>
      <div className={`max-w-xs md:max-w-md lg:max-w-2xl px-4 py-3 rounded-2xl shadow-md transition-all duration-300 ${
        isUser
          ? 'bg-cyan-500/50 text-white rounded-br-none'
          : 'bg-gray-500/30 text-gray-200 rounded-bl-none'
      }`}>
        <p className="whitespace-pre-wrap">{message.parts.map(p => p.text).join('')}</p>
      </div>
    </div>
  );
};

export default MessageComponent;
