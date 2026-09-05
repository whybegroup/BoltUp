'use dom';

export default function HtmlPreview({
  html,
}: {
  html: string;
  dom?: import('expo/dom').DOMProps;
}) {
  return (
    <iframe
      srcDoc={html}
      sandbox="allow-scripts allow-forms"
      title="HTML preview"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        border: 'none',
        background: '#fff',
        borderRadius: 8,
      }}
    />
  );
}
