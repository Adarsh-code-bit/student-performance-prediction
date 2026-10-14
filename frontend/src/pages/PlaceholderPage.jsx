import { Construction } from 'lucide-react';

export default function PlaceholderPage({ title, description }) {
  return (
    <div>
      <div className="page-header">
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="placeholder-page">
        <Construction size={48} />
        <h2>{title}</h2>
        <p>This module will be implemented in a future phase.</p>
      </div>
    </div>
  );
}
