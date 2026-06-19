export default function SearchInput({ value, onChange, placeholder }) {
  return (
    <div className="search-input">
      <svg className="s-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
        <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" strokeLinecap="round" />
      </svg>
      <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}
