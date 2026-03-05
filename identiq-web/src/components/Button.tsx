export default function Button({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="
        w-full
        bg-black
        text-white
        py-3
        rounded-lg
        hover:bg-gray-800
        transition
        cursor-pointer
      "
    >
      {children}
    </button>
  );
}