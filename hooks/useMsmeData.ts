import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useMsmeData() {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Use useCallback to memoize the function, which is best practice
    const fetchData = useCallback(async () => {
        setLoading(true);
        const { data: msmeData, error } = await supabase.from('msme_entities').select('*');
        if (error) {
            console.error('Error fetching MSME data:', error);
        } else {
            setData(msmeData || []);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return { data, loading, refetch: fetchData };
}