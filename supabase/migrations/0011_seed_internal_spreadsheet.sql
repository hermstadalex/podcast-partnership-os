-- Add abbreviation column to shows
ALTER TABLE public.shows ADD COLUMN IF NOT EXISTS abbreviation text;

-- Temporarily drop the trigger or ensure we just insert safely using uuid_generate_v4()
-- We will use DO block to generate predictable or random UUIDs and handle inserts

DO $$
DECLARE
    client1 uuid := uuid_generate_v4();
    client2 uuid := uuid_generate_v4();
    client3 uuid := uuid_generate_v4();
    client4 uuid := uuid_generate_v4();
    client5 uuid := uuid_generate_v4();
    client6 uuid := uuid_generate_v4();
    client7 uuid := uuid_generate_v4();
    client8 uuid := uuid_generate_v4();
BEGIN

    -- Insert Clients
    INSERT INTO public.clients (id, name, email, captivate_show_id) VALUES
    (client1, 'Frank Kern', 'frank@podcastpartnership.com', 'captivate_YNM'),
    (client2, 'David McKnight', 'david@podcastpartnership.com', 'captivate_POZ'),
    (client3, 'Amy Hudson', 'amy@podcastpartnership.com', 'captivate_SCE'),
    (client4, 'Tara Bartley', 'tara@podcastpartnership.com', 'captivate_ANY'),
    (client5, 'Tyson Ray', 'tyson@podcastpartnership.com', 'captivate_TYR'),
    (client6, 'Robert Levin', 'robert@podcastpartnership.com', 'captivate_NTB'),
    (client7, 'Mike Erre', 'mike@podcastpartnership.com', 'captivate_VOX'),
    (client8, 'Kim Spear', 'kim@podcastpartnership.com', 'captivate_AVL')
    ON CONFLICT DO NOTHING;

    -- Insert Shows
    INSERT INTO public.shows (client_id, title, abbreviation, captivate_show_id, author) VALUES
    (client1, 'Your Next Million', 'YNM', 'captivate_YNM', 'Frank Kern'),
    (client2, 'Power Of Zero', 'POZ', 'captivate_POZ', 'David McKnight'),
    (client3, 'Strength Changes Everything', 'SCE', 'captivate_SCE', 'Amy Hudson'),
    (client4, 'The Anycast', 'ANY', 'captivate_ANY', 'Tara Bartley'),
    (client5, 'Total Succession', 'TYR', 'captivate_TYR', 'Tyson Ray'),
    (client6, 'New Talent Playbook', 'NTB', 'captivate_NTB', 'Robert Levin'),
    (client7, 'Voxology', 'VOX', 'captivate_VOX', 'Mike Erre'),
    (client8, 'Adventurous Living', 'AVL', 'captivate_AVL', 'Kim Spear')
    ON CONFLICT DO NOTHING;

END $$;
