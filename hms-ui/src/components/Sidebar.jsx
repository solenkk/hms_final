import { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  LayoutDashboard, Users, Stethoscope, FlaskConical,
  Pill, ReceiptText, BedDouble, BarChart3, Settings,
  LogOut, Hospital, ChevronRight, PanelLeftClose, PanelLeftOpen
} from 'lucide-react'
import './Sidebar.css'

// Role-based nav items:
// roles: null = everyone, array = only those roles
const NAV_ITEMS = [
  { to: '/',         icon: LayoutDashboard, label: 'Dashboard',    roles: null },
  { to: '/patients', icon: Users,           label: 'Patients',     roles: ['admin', 'doctor', 'nurse', 'receptionist', 'cashier'] },
  { to: '/visits',   icon: Stethoscope,     label: 'Visits',       roles: ['admin', 'doctor', 'nurse', 'receptionist', 'cashier'] },
  { to: '/emr',      icon: FileText,        label: 'EMR',          roles: ['doctor', 'nurse', 'admin'] },
  { to: '/lab',      icon: FlaskConical,    label: 'Laboratory',   roles: ['admin', 'doctor', 'nurse', 'lab_technician'] },
  { to: '/pharmacy', icon: Pill,            label: 'Pharmacy',     roles: ['admin', 'doctor', 'nurse', 'pharmacist'] },
  { to: '/billing',  icon: ReceiptText,     label: 'Billing',      roles: ['admin', 'cashier', 'receptionist'] },
  { to: '/beds',     icon: BedDouble,       label: 'Beds & Wards', roles: ['admin', 'nurse', 'receptionist', 'cashier', 'doctor'] },
  { to: '/reports',  icon: BarChart3,       label: 'Reports',      roles: ['admin', 'doctor'] },
  { to: '/admin',    icon: Settings,        label: 'Admin',        roles: ['admin'] },
]

// Inline FileText icon
function FileText(props) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="18" height="18"
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  )
}

export default function Sidebar() {
  const { user, logout, hasRole } = useAuth()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    document.body.setAttribute('data-sidebar-collapsed', collapsed)
  }, [collapsed])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const initials = user?.full_name_en
    ? user.full_name_en.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()
    : 'US'

  const visibleItems = NAV_ITEMS.filter(item =>
    !item.roles || hasRole(...item.roles)
  )

  return (
    <aside className={`sidebar${collapsed ? ' sidebar-collapsed' : ''}`}>
      {/* Brand */}
      <div className="sidebar-brand">
        <div className="brand-icon">
          <Hospital size={22} />
        </div>
        {!collapsed && (
          <div className="brand-text">
            <div className="brand-name">Kassahun Clinic</div>
            <div className="brand-sub">Medium Clinic · Shagar</div>
          </div>
        )}
        <button
          className="sidebar-toggle"
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {visibleItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            title={collapsed ? label : ''}
          >
            <Icon size={18} />
            {!collapsed && <span className="nav-label">{label}</span>}
            {!collapsed && <ChevronRight size={14} className="nav-chevron" />}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="avatar">{initials}</div>
        {!collapsed && (
          <div className="user-info">
            <div className="user-name">{user?.full_name_en || user?.username}</div>
            <div className="user-role">{user?.role?.replace('_', ' ')}</div>
          </div>
        )}
        <button className="btn-icon btn-ghost logout-btn" onClick={handleLogout} title="Logout">
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  )
}
