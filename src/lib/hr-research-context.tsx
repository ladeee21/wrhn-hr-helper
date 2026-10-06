import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { seedChecks, seedReviews, type DatasetCheck, type ReviewItem } from "./hr-research-data";
type Role="Advisor"|"Reviewer";
type State={role:Role;setRole:(r:Role)=>void;reviews:ReviewItem[];addReview:(r:ReviewItem)=>void;markReviewed:(id:string)=>void;checks:DatasetCheck[];addCheck:(c:DatasetCheck)=>void};
const Ctx=createContext<State|undefined>(undefined);
export function HrResearchProvider({children}:{children:ReactNode}){const[role,setRole]=useState<Role>("Advisor");const[reviews,setReviews]=useState(seedReviews);const[checks,setChecks]=useState(seedChecks);const addReview=useCallback((r:ReviewItem)=>setReviews(v=>[r,...v]),[]);const markReviewed=useCallback((id:string)=>setReviews(v=>v.map(r=>r.id===id?{...r,status:"Reviewed"}:r)),[]);const addCheck=useCallback((c:DatasetCheck)=>setChecks(v=>v.some(x=>x.id===c.id)?v:[c,...v]),[]);return <Ctx.Provider value={{role,setRole,reviews,addReview,markReviewed,checks,addCheck}}>{children}</Ctx.Provider>}
export function useHrResearch(){const value=useContext(Ctx);if(!value)throw new Error("HR research context is unavailable");return value}