export default function FloatingShapes() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10" aria-hidden="true">
      <div className="absolute -top-10 -right-10 w-56 h-56 rounded-full bg-saffron/20 blur-3xl animate-float" />
      <div
        className="absolute top-1/3 -left-16 w-64 h-64 rounded-full bg-juniper/20 blur-3xl animate-float"
        style={{ animationDelay: "2s" }}
      />
      <div
        className="absolute bottom-0 right-1/4 w-48 h-48 rounded-full bg-brick/10 blur-3xl animate-float"
        style={{ animationDelay: "4s" }}
      />
    </div>
  );
}
