import Link from "next/link";
const ShinyLink = ({ text="", disabled = false, speed = 5, className = '' ,link=""}) => {
  const animationDuration = `${speed}s`;

  return (
    <Link
      className={`text-white/60 bg-clip-text inline-block ${disabled ? '' : 'animate-shine'} ${className}`}
      href={link}
      style={{
        backgroundImage: 'linear-gradient(120deg, rgba(255, 255, 255, 0) 40%, rgba(255, 255, 255, 0.8) 50%, rgba(255, 255, 255, 0) 60%)',
        backgroundSize: '200% 100%',
        WebkitBackgroundClip: 'text',
        animationDuration: animationDuration,
      }}
    >
      {text}
    </Link>
  );
};

export default ShinyLink;