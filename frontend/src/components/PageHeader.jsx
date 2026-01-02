
export default function PageHeader({ title, description, icon: Icon, color = 'blue', children }) {
  const gradients = {
    blue: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
    green: 'linear-gradient(135deg, #065f46 0%, #10b981 100%)',
    purple: 'linear-gradient(135deg, #581c87 0%, #8b5cf6 100%)',
    orange: 'linear-gradient(135deg, #7c2d12 0%, #f97316 100%)',
  };

  const background = gradients[color] || gradients.blue;

  return (
    <div style={{
      background: background,
      padding: '2rem 2.5rem',
      marginBottom: '2rem',
      color: 'white',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        maxWidth: '1200px', 
        margin: '0 auto',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {Icon && (
            <div style={{ 
              background: 'rgba(255,255,255,0.2)', 
              padding: '1rem', 
              borderRadius: '12px',
              marginRight: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Icon size={32} color="white" />
            </div>
          )}
          <div>
            <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 700 }}>{title}</h1>
            {description && (
              <p style={{ margin: '0.5rem 0 0', opacity: 0.9, fontSize: '1rem', fontWeight: 400 }}>
                {description}
              </p>
            )}
          </div>
        </div>
        
        {children && (
          <div style={{ display: 'flex', gap: '1rem' }}>
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
