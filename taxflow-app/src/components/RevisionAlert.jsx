import { motion } from 'framer-motion'
import { AlertOctagon } from 'lucide-react'

export default function RevisionAlert({ comments }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      className="rounded-[16px] border border-[#ffb4ab]/30 p-5 bg-[#ffb4ab]/10 backdrop-blur-md relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-[100px] h-[100px] bg-[#ffb4ab]/20 rounded-full blur-[40px] pointer-events-none -translate-y-1/2 translate-x-1/2" />
      
      <div className="flex items-start gap-4 relative z-10">
        <div className="w-10 h-10 rounded-full bg-[#ffb4ab]/20 flex items-center justify-center shrink-0 border border-[#ffb4ab]/30 shadow-[0_0_15px_rgba(255,180,171,0.2)]">
           <AlertOctagon size={20} className="text-[#ffb4ab]" strokeWidth={2.5} />
        </div>
        <div>
          <h4 className="m-0 text-[15px] font-bold text-[#ffb4ab] tracking-tight">
            Revision Requested
          </h4>
          <p className="m-0 mt-1.5 text-[14px] leading-relaxed text-[var(--color-on-surface-variant)]">
            {comments}
          </p>
        </div>
      </div>
    </motion.div>
  )
}
