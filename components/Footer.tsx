import KilimDivider from "./KilimDivider";

export default function Footer() {
  return (
    <footer className="mt-16">
      <KilimDivider />
      <div className="max-w-3xl mx-auto px-5 py-8 flex flex-col items-center gap-3 text-sm text-ink/60">
        <p>مهاباد از نگاه شما</p>
        <div className="flex items-center gap-5">
          <a
            href="https://rubika.ir/joinc/FFFFGIBA0WSKEDSHYOWNEGNYIBXDMXZX"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-saffron hover:text-brick focus-ring"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2 3 7v10l9 5 9-5V7l-9-5zm0 2.3 6.7 3.7-6.7 3.7-6.7-3.7L12 4.3zM5 9.2l6 3.3v6.9l-6-3.3V9.2zm14 0v6.9l-6 3.3v-6.9l6-3.3z" />
            </svg>
            کانال روبیکا
          </a>
          <a
            href="https://www.instagram.com/kebria2710?igsi=M2sydzdhd2k0Zml1"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-juniper hover:text-brick focus-ring"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="5" />
              <circle cx="12" cy="12" r="4" />
              <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
            </svg>
            اینستاگرام
          </a>
        </div>
      </div>
    </footer>
  );
}
